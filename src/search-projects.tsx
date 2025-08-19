import { Action, ActionPanel, List, getPreferenceValues, showToast, Toast, open } from "@raycast/api";
import { useState, useEffect } from "react";

interface Preferences {
    odooUrl: string;
    apiKey: string;
    database: string;
    userLogin: string;
}

interface Project {
    id: number;
    name: string;
    display_name: string;
    description?: string;
    user_id?: [number, string];
    partner_id?: [number, string];
    stage_id?: [number, string];
    task_count?: number;
}

interface OdooResponse {
    result?: Project[];
    error?: {
        message: string;
        data?: {
            name: string;
            message: string;
        };
    };
}

export default function SearchProjects() {
    const preferences = getPreferenceValues<Preferences>();
    const [searchText, setSearchText] = useState("");
    const [projects, setProjects] = useState<Project[]>([]);
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
    const searchProjects = async (query: string): Promise<Project[]> => {
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
                        "project.project", // model
                        "search_read", // method
                        [["|", ["name", "ilike", query], ["display_name", "ilike", query]]], // domain
                        {
                            fields: [
                                "id",
                                "name",
                                "display_name",
                                "description",
                                "user_id",
                                "partner_id",
                                "stage_id",
                                "task_count",
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
            console.error("Error searching projects:", error);
            showToast({
                style: Toast.Style.Failure,
                title: "Error",
                message: error instanceof Error ? error.message : "Failed to search projects",
            });
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    // Debounced search effect
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchText.length >= 2) {
                searchProjects(searchText).then(setProjects);
            } else {
                setProjects([]);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchText]);

    // Fonction pour ouvrir les tâches du projet
    const openProjectTasks = (project: Project) => {
        const tasksUrl = `${preferences.odooUrl.replace(/\/$/, "")}/odoo/action-369/${project.id}/tasks`;
        open(tasksUrl);
    };

    return (
        <List
            isLoading={isLoading}
            onSearchTextChange={setSearchText}
            searchBarPlaceholder="Search projects by name..."
            throttle>
            <List.Section title="Projects" subtitle={`${projects.length} project${projects.length !== 1 ? "s" : ""}`}>
                {projects.map(project => (
                    <List.Item
                        key={project.id}
                        title={project.display_name || project.name}
                        subtitle={project.description}
                        accessories={[
                            ...(project.task_count ? [{ text: `${project.task_count} tasks` }] : []),
                            ...(project.user_id ? [{ text: project.user_id[1] }] : []),
                        ]}
                        actions={
                            <ActionPanel>
                                <Action
                                    title="Open Project Tasks"
                                    onAction={() => openProjectTasks(project)}
                                    icon="📋"
                                />
                                <Action.CopyToClipboard
                                    title="Copy Project Name"
                                    content={project.display_name || project.name}
                                />
                                <Action.CopyToClipboard
                                    title="Copy Project URL"
                                    content={`${preferences.odooUrl.replace(/\/$/, "")}/web#id=${project.id}&model=project.project&view_type=form`}
                                />
                            </ActionPanel>
                        }
                    />
                ))}
            </List.Section>
            {searchText.length > 0 && searchText.length < 2 && (
                <List.EmptyView title="Type at least 2 characters" description="Start typing to search for projects" />
            )}
            {searchText.length >= 2 && projects.length === 0 && !isLoading && (
                <List.EmptyView title="No projects found" description="Try adjusting your search query" />
            )}
        </List>
    );
}
