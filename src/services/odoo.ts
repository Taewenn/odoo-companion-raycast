import { showToast, Toast } from "@raycast/api";
import { Preferences, OdooResponse, OdooSearchOptions } from "../types";

export class OdooService {
    private preferences: Preferences;
    private uid: number | null = null;

    constructor(preferences: Preferences) {
        this.preferences = preferences;
    }

    private get apiUrl(): string {
        return `${this.preferences.odooUrl.replace(/\/$/, "")}/jsonrpc`;
    }

    /**
     * Authentifie l'utilisateur et récupère l'UID
     */
    async authenticate(): Promise<number | null> {
        if (this.uid) {
            return this.uid;
        }

        try {
            const authBody = {
                jsonrpc: "2.0",
                method: "call",
                params: {
                    service: "common",
                    method: "login",
                    args: [this.preferences.database, this.preferences.userLogin, this.preferences.apiKey],
                },
                id: Math.floor(Math.random() * 1000000),
            };

            const response = await fetch(this.apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(authBody),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = (await response.json()) as OdooResponse<number>;

            if (data.error) {
                throw new Error(data.error.data?.message || data.error.message);
            }

            this.uid = data.result || null;
            return this.uid;
        } catch (error) {
            console.error("Authentication error:", error);
            showToast({
                style: Toast.Style.Failure,
                title: "Authentication Error",
                message: error instanceof Error ? error.message : "Failed to authenticate with Odoo",
            });
            return null;
        }
    }

    /**
     * Exécute une méthode Odoo générique
     */
    async execute<T = any>(
        model: string,
        method: string,
        args: any[] = [],
        kwargs: Record<string, any> = {},
    ): Promise<T | null> {
        try {
            const uid = await this.authenticate();
            if (!uid) {
                return null;
            }

            const requestBody = {
                jsonrpc: "2.0",
                method: "call",
                params: {
                    service: "object",
                    method: "execute_kw",
                    args: [this.preferences.database, uid, this.preferences.apiKey, model, method, args, kwargs],
                },
                id: Math.floor(Math.random() * 1000000),
            };

            const response = await fetch(this.apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = (await response.json()) as OdooResponse<T>;

            if (data.error) {
                throw new Error(data.error.data?.message || data.error.message);
            }

            return data.result || null;
        } catch (error) {
            console.error(`Error executing ${model}.${method}:`, error);
            throw error;
        }
    }

    /**
     * Recherche des enregistrements avec un domaine de recherche
     */
    async searchRead<T = any>(model: string, domain: any[] = [], options: OdooSearchOptions): Promise<T[]> {
        try {
            const result = await this.execute<T[]>(model, "search_read", [domain], options);
            return result || [];
        } catch (error) {
            console.error(`Error searching ${model}:`, error);
            showToast({
                style: Toast.Style.Failure,
                title: "Search Error",
                message: error instanceof Error ? error.message : `Failed to search ${model}`,
            });
            return [];
        }
    }

    /**
     * Recherche des enregistrements par nom
     */
    async searchByName<T = any>(
        model: string,
        query: string,
        options: Omit<OdooSearchOptions, "domain">,
    ): Promise<T[]> {
        const domain = ["|", ["name", "ilike", query], ["display_name", "ilike", query]];
        return this.searchRead<T>(model, domain, { ...options, domain });
    }

    /**
     * Récupère tous les enregistrements d'un modèle (avec limite)
     */
    async getAll<T = any>(
        model: string,
        options: Omit<OdooSearchOptions, "domain"> & { limit?: number } = { fields: [] },
    ): Promise<T[]> {
        const searchOptions: OdooSearchOptions = {
            ...options,
            limit: options.limit || 100,
        };
        return this.searchRead<T>(model, [], searchOptions);
    }

    /**
     * Invalide le cache d'authentification
     */
    invalidateAuth(): void {
        this.uid = null;
    }
}
