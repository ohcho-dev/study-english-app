export const APP_NAME = 'Research CMS';

export const ROUTES = {
    home: '/',
    lab: {
        variables: '/lab/variables',
        prompts: '/lab/prompts',
        analytics: '/lab/analytics',
    },
    contents: {
        scenarios: '/contents/scenarios',
    },
    settings: {
        themes: '/settings/themes',
        users: '/settings/users',
    },
} as const;
