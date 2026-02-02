// Prompt entity types
export interface Prompt {
    id: string;
    name: string;
    description: string | null;
    current_version: number;
    is_active: boolean;
    created_at: string;
    updated_at: string | null;
}

export interface PromptVersion {
    id: string;
    prompt_id: string;
    version: number;
    system_prompt: string;
    model_name: string;
    temperature: number;
    max_tokens: number;
    created_at: string;
    created_by: string | null;
}

export interface PromptCreate {
    name: string;
    description?: string;
    system_prompt: string;
    model_name?: string;
    temperature?: number;
    max_tokens?: number;
}
