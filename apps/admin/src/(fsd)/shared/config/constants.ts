export const APP_NAME = 'Research CMS';

export const ROUTES = {
    home: '/',
    lab: {
        variables: '/lab/variables',
        prompts: '/lab/prompts',
        analytics: '/lab/analytics',
    },
    aiLab: {
        pipelines: '/ai-lab/pipelines',
        experiment: '/ai-lab/experiment',
        logs: '/ai-lab/logs',
    },
    conversations: {
        run0: '/conversations/run0',
        templates: '/conversations/templates',
        sessions: '/conversations/sessions',
    },
    contents: {
        scenarios: '/contents/scenarios',
    },
    settings: {
        themes: '/settings/themes',
        users: '/settings/users',
    },
} as const;

