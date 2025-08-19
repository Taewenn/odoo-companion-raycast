import { Action, ActionPanel, List, Toast, getPreferenceValues, open, showToast } from "@raycast/api";
import { useState, useEffect } from "react";
import { OdooService } from "./services/odoo";
import { Preferences, Project } from "./types";

export default function SearchProjects() {
    const preferences = getPreferenceValues<Preferences>();
    const [searchText, setSearchText] = useState("");
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const odooService = new OdooService(preferences);

    // Fonction pour rechercher des projets
    const searchProjects = async (query: string): Promise<Project[]> => {
        if (!query.trim()) return [];

        setIsLoading(true);
        try {
            const results = await odooService.searchByName<Project>("project.project", query, {
                fields: [
                    "id",
                    "name",
                    "display_name",
                    "description",
                    "user_id",
                    "partner_id",
                    "stage_id",
                    "task_count",
                    "active",
                    "company_id",
                    "date_start",
                    "date",
                ],
            });
            return results;
        } finally {
            setIsLoading(false);
        }
    };

    // Fonction pour récupérer tous les projets
    const getAllProjects = async (): Promise<Project[]> => {
        setIsLoading(true);
        try {
            const results = await odooService.getAll<Project>("project.project", {
                fields: [
                    "id",
                    "name",
                    "display_name",
                    "description",
                    "user_id",
                    "partner_id",
                    "stage_id",
                    "task_count",
                    "active",
                    "company_id",
                    "date_start",
                    "date",
                ],
                limit: 100,
            });
            return results;
        } finally {
            setIsLoading(false);
        }
    };

    // Effect pour charger tous les projets au démarrage
    useEffect(() => {
        getAllProjects().then(setProjects);
    }, []);

    // Debounced search effect
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchText.length >= 2) {
                searchProjects(searchText).then(setProjects);
            } else if (searchText.length === 0) {
                // Si pas de recherche, recharger tous les projets
                getAllProjects().then(setProjects);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchText]);

    // Fonction pour ouvrir les tâches du projet
    const openProjectTasks = (project: Project) => {
        const tasksUrl = `${preferences.odooUrl.replace(/\/$/, "")}/odoo/action-369/${project.id}/tasks`;

        try {
            open(tasksUrl);
        } catch (error) {
            console.error("Error opening project tasks:", error);
            showToast({
                style: Toast.Style.Failure,
                title: "Error opening tasks",
                message: "Could not open project tasks. Please check the URL manually.",
            });
        }
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
                            ...(project.user_id ? [{ text: `Manager: ${project.user_id[1]}` }] : []),
                            ...(project.partner_id ? [{ text: `Client: ${project.partner_id[1]}` }] : []),
                            ...(project.stage_id ? [{ text: project.stage_id[1] }] : []),
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
                                    content={`${preferences.odooUrl.replace(/\/$/, "")}/odoo/action-369/${project.id}/tasks`}
                                />
                            </ActionPanel>
                        }
                    />
                ))}
            </List.Section>
            {searchText.length > 0 && searchText.length < 2 && (
                <List.EmptyView
                    title="Type at least 2 characters"
                    description="Start typing to search for projects by name"
                />
            )}
            {searchText.length >= 2 && projects.length === 0 && !isLoading && (
                <List.EmptyView
                    title="No projects found"
                    description={`No projects match "${searchText}". Try a different search term or check if the Project module is installed in Odoo.`}
                />
            )}
            {searchText.length === 0 && projects.length === 0 && !isLoading && (
                <List.EmptyView
                    title="No projects available"
                    description="No projects found. Make sure the Project module is installed and you have the necessary permissions."
                />
            )}
        </List>
    );
}
