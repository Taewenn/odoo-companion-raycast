import { Action, ActionPanel, List, getPreferenceValues, showToast, Toast, open } from "@raycast/api";
import { useState, useEffect } from "react";

interface Preferences {
    odooUrl: string;
    apiKey: string;
    database: string;
    userLogin: string;
}

interface HelpdeskTeam {
    id: number;
    name: string;
    display_name: string;
    description?: string;
    member_ids?: number[]; // Team members
    use_helpdesk_timesheet?: boolean;
    use_helpdesk_sale_timesheet?: boolean;
    ticket_count?: number;
    stage_ids?: number[]; // Stages disponibles pour cette équipe
    company_id?: [number, string]; // Société
    active?: boolean; // Équipe active ou non
}

interface OdooResponse {
    result?: HelpdeskTeam[];
    error?: {
        message: string;
        data?: {
            name: string;
            message: string;
        };
    };
}

export default function SearchHelpdesk() {
    const preferences = getPreferenceValues<Preferences>();
    const [searchText, setSearchText] = useState("");
    const [helpdeskTeams, setHelpdeskTeams] = useState<HelpdeskTeam[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Fonction pour s'authentifier et obtenir l'UID
    const authenticate = async (): Promise<number | null> => {
        try {
            const apiUrl = `${preferences.odooUrl.replace(/\/$/, "")}/jsonrpc`;

            const authBody = {
                jsonrpc: "2.0",
                method: "call",
                params: {
                    service: "common",
                    method: "login",
                    args: [preferences.database, preferences.userLogin, preferences.apiKey], // database, login, password (API key)
                },
                id: Math.floor(Math.random() * 1000000),
            };

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(authBody),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = (await response.json()) as {
                result: number;
                error?: { message: string; data?: { message: string } };
            };

            if (data.error) {
                throw new Error(data.error.data?.message || data.error.message);
            }

            return data.result;
        } catch (error) {
            console.error("Authentication error:", error);
            showToast({
                style: Toast.Style.Failure,
                title: "Authentication Error",
                message: error instanceof Error ? error.message : "Failed to authenticate with Odoo",
            });
            return null;
        }
    };

    // Fonction pour appeler l'API Odoo
    const searchHelpdeskTeams = async (query: string): Promise<HelpdeskTeam[]> => {
        if (!query.trim()) return [];

        try {
            setIsLoading(true);

            // D'abord s'authentifier pour obtenir l'UID
            const uid = await authenticate();
            if (!uid) {
                return [];
            }

            const apiUrl = `${preferences.odooUrl.replace(/\/$/, "")}/jsonrpc`;

            const requestBody = {
                jsonrpc: "2.0",
                method: "call",
                params: {
                    service: "object",
                    method: "execute_kw",
                    args: [
                        preferences.database,
                        uid,
                        preferences.apiKey,
                        "helpdesk.team", // model
                        "search_read", // method
                        [["|", ["name", "ilike", query], ["display_name", "ilike", query]]], // domain
                        {
                            fields: [
                                "id",
                                "name",
                                "display_name",
                                "description",
                                "member_ids",
                                "use_helpdesk_timesheet",
                                "use_helpdesk_sale_timesheet",
                                "stage_ids",
                                "company_id",
                                "active",
                            ],
                        },
                    ],
                },
                id: Math.floor(Math.random() * 1000000),
            };

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = (await response.json()) as OdooResponse;

            if (data.error) {
                throw new Error(data.error.data?.message || data.error.message);
            }

            return data.result || [];
        } catch (error) {
            console.error("Error searching helpdesk teams:", error);
            showToast({
                style: Toast.Style.Failure,
                title: "Error",
                message: error instanceof Error ? error.message : "Failed to search helpdesk teams",
            });
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    // Fonction pour récupérer toutes les équipes helpdesk
    const getAllHelpdeskTeams = async (): Promise<HelpdeskTeam[]> => {
        try {
            setIsLoading(true);

            const uid = await authenticate();
            if (!uid) {
                return [];
            }

            const apiUrl = `${preferences.odooUrl.replace(/\/$/, "")}/jsonrpc`;

            const requestBody = {
                jsonrpc: "2.0",
                method: "call",
                params: {
                    service: "object",
                    method: "execute_kw",
                    args: [
                        preferences.database,
                        uid,
                        preferences.apiKey,
                        "helpdesk.team",
                        "search_read",
                        [[]], // domain vide pour récupérer toutes les équipes
                        {
                            fields: [
                                "id",
                                "name",
                                "display_name",
                                "description",
                                "member_ids",
                                "use_helpdesk_timesheet",
                                "use_helpdesk_sale_timesheet",
                                "stage_ids",
                                "company_id",
                                "active",
                            ],
                            limit: 100, // Limite raisonnable
                        },
                    ],
                },
                id: Math.floor(Math.random() * 1000000),
            };

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = (await response.json()) as OdooResponse;

            if (data.error) {
                throw new Error(data.error.data?.message || data.error.message);
            }

            return data.result || [];
        } catch (error) {
            console.error("Error getting all helpdesk teams:", error);
            showToast({
                style: Toast.Style.Failure,
                title: "Error",
                message: error instanceof Error ? error.message : "Failed to get helpdesk teams",
            });
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    // Effect pour charger toutes les équipes au démarrage
    useEffect(() => {
        getAllHelpdeskTeams().then(setHelpdeskTeams);
    }, []);

    // Debounced search effect
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchText.length >= 2) {
                searchHelpdeskTeams(searchText).then(setHelpdeskTeams);
            } else if (searchText.length === 0) {
                // Si pas de recherche, recharger toutes les équipes
                getAllHelpdeskTeams().then(setHelpdeskTeams);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchText]);

    // Fonction pour ouvrir les tickets de l'équipe helpdesk
    const openHelpdeskTickets = (team: HelpdeskTeam) => {
        const ticketsUrl = `${preferences.odooUrl.replace(/\/$/, "")}/odoo/helpdesk/${team.id}/tickets`;

        try {
            open(ticketsUrl);
        } catch (error) {
            console.error("Error opening primary URL:", error);
            showToast({
                style: Toast.Style.Failure,
                title: "Error opening tickets",
                message: "Could not open helpdesk tickets. Please check the URL manually.",
            });
        }
    };

    return (
        <List
            isLoading={isLoading}
            onSearchTextChange={setSearchText}
            searchBarPlaceholder="Search helpdesk teams by name..."
            throttle>
            <List.Section
                title="Helpdesk Teams"
                subtitle={`${helpdeskTeams.length} team${helpdeskTeams.length !== 1 ? "s" : ""}`}>
                {helpdeskTeams.map(team => (
                    <List.Item
                        key={team.id}
                        title={team.display_name || team.name}
                        subtitle={team.description}
                        accessories={[
                            ...(team.member_ids && team.member_ids.length > 0
                                ? [{ text: `${team.member_ids.length} members` }]
                                : []),
                            ...(team.company_id ? [{ text: team.company_id[1] }] : []),
                            ...(team.active === false ? [{ text: "Inactive", icon: "⚠️" }] : []),
                        ]}
                        actions={
                            <ActionPanel>
                                <Action
                                    title="Open Helpdesk Tickets"
                                    onAction={() => openHelpdeskTickets(team)}
                                    icon="🎫"
                                />
                                <Action.CopyToClipboard
                                    title="Copy Team Name"
                                    content={team.display_name || team.name}
                                />
                                <Action.CopyToClipboard
                                    title="Copy Team URL"
                                    content={`${preferences.odooUrl.replace(/\/$/, "")}/web#id=${team.id}&model=helpdesk.team&view_type=form`}
                                />
                            </ActionPanel>
                        }
                    />
                ))}
            </List.Section>
            {searchText.length > 0 && searchText.length < 2 && (
                <List.EmptyView
                    title="Type at least 2 characters"
                    description="Start typing to search for helpdesk teams by name"
                />
            )}
            {searchText.length >= 2 && helpdeskTeams.length === 0 && !isLoading && (
                <List.EmptyView
                    title="No helpdesk teams found"
                    description={`No teams match "${searchText}". Try a different search term or check if the Helpdesk module is installed in Odoo.`}
                />
            )}
            {searchText.length === 0 && helpdeskTeams.length === 0 && !isLoading && (
                <List.EmptyView
                    title="No helpdesk teams available"
                    description="No helpdesk teams found. Make sure the Helpdesk module is installed and you have the necessary permissions."
                />
            )}
        </List>
    );
}
