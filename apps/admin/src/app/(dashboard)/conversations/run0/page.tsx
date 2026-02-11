'use client';

/**
 * Latency Lab (Run0) Page
 * 
 * Pure latency measurement tool for STT → LLM → TTS pipeline.
 * No template or scenario dependencies.
 */

import { Suspense } from 'react';

import { Run0Runner } from '@/features/conversations';

function Run0Content() {
    return <Run0Runner />;
}

export default function Run0Page() {
    return (
        <div className="container mx-auto py-6 px-4">
            <Suspense fallback={
                <div className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground">Loading Latency Lab...</p>
                </div>
            }>
                <Run0Content />
            </Suspense>
        </div>
    );
}
