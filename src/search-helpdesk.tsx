import { Action, ActionPanel, List, getPreferenceValues, showToast, Toast, open } from "@raycast/api";
import { useState, useEffect } from "react";
import { OdooService } from "./services/odoo";
import { Preferences, HelpdeskTeam } from "./types";

export default function SearchHelpdesk() {
    const preferences = getPreferenceValues<Preferences>();
    const [searchText, setSearchText] = useState("");
    const [helpdeskTeams, setHelpdeskTeams] = useState<HelpdeskTeam[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const odooService = new OdooService(preferences);

    // Fonction pour rechercher des équipes helpdesk
    const searchHelpdeskTeams = async (query: string): Promise<HelpdeskTeam[]> => {
        if (!query.trim()) return [];

        setIsLoading(true);
        try {
            const results = await odooService.searchByName<HelpdeskTeam>("helpdesk.team", query, {
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
            });
            return results;
        } finally {
            setIsLoading(false);
        }
    };

    // Fonction pour récupérer toutes les équipes helpdesk
    const getAllHelpdeskTeams = async (): Promise<HelpdeskTeam[]> => {
        setIsLoading(true);
        try {
            const results = await odooService.getAll<HelpdeskTeam>("helpdesk.team", {
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
                limit: 100,
            });
            return results;
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
