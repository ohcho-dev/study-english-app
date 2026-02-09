import { ChevronsUpDown } from "lucide-react";
import { useTemplates } from "../model/useTemplates";
import { Button } from "@/shared/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

interface TemplateSelectorProps {
    value?: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export const TemplateSelector = ({
    value,
    onChange,
    disabled,
}: TemplateSelectorProps) => {
    const { data: templates, isLoading } = useTemplates();
    const selectedTemplate = templates?.items.find((t) => t.id === value);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className="w-full justify-between"
                    disabled={disabled || isLoading}
                >
                    {selectedTemplate ? selectedTemplate.name : "Select a template..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[300px]" align="start">
                {isLoading ? (
                    <DropdownMenuItem disabled>Loading templates...</DropdownMenuItem>
                ) : templates?.items.length === 0 ? (
                    <DropdownMenuItem disabled>No templates found</DropdownMenuItem>
                ) : (
                    templates?.items.map((template) => (
                        <DropdownMenuItem
                            key={template.id}
                            onClick={() => onChange(template.id)}
                            className={value === template.id ? 'bg-destructive/10' : ''} // Changed from bg-accent for better visibility if needed, or stick to accent
                        >
                            <div className="flex-1 flex flex-col items-start gap-1">
                                <div className="font-medium">{template.name}</div>
                                {template.topic && (
                                    <div className="text-xs text-muted-foreground w-full truncate">
                                        {template.topic}
                                    </div>
                                )}
                            </div>
                        </DropdownMenuItem>
                    ))
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
