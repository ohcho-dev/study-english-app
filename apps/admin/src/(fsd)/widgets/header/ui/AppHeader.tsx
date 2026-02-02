'use client';

import { Input } from '@/shared/ui/input';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';
import { SidebarTrigger } from '@/shared/ui/sidebar';
import { Search } from 'lucide-react';

export const AppHeader = () => {
    return (
        <header className="flex h-14 items-center justify-between border-b border-border px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-4">
                <SidebarTrigger className="-ml-1" />
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="검색..."
                        className="w-64 pl-8 bg-muted/50"
                    />
                </div>
            </div>
            <div className="flex items-center gap-4">
                <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        AD
                    </AvatarFallback>
                </Avatar>
            </div>
        </header>
    );
};
