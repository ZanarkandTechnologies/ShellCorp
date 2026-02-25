"use client";

/**
 * SECRETS PANEL
 * =============
 * 
 * UI component for managing user secrets (API keys, tokens).
 * Styled like environment variable management.
 */

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Key,
    Plus,
    Trash2,
    Eye,
    EyeOff,
    Loader2,
    Github,
    Bot,
    Cloud,
    Lock,
    type LucideIcon
} from "lucide-react";

import { cn } from "@/lib/utils";

type SecretType = "github_pat" | "openai_api_key" | "anthropic_api_key" | "morph_api_key" | "apify_api_key" | "custom";

interface SecretStatus {
    secretType: SecretType;
    label: string | null;
    maskedValue: string;
    updatedAt: number;
}

const SECRET_TYPE_INFO: Record<SecretType, { label: string; icon: LucideIcon; placeholder: string; description: string }> = {
    github_pat: {
        label: "GitHub PAT",
        icon: Github,
        placeholder: "ghp_xxxxxxxxxxxx",
        description: "Personal Access Token for private repo access",
    },
    openai_api_key: {
        label: "OpenAI API Key",
        icon: Bot,
        placeholder: "sk-xxxxxxxxxxxxxxxx",
        description: "For GPT models and embeddings",
    },
    anthropic_api_key: {
        label: "Anthropic API Key",
        icon: Bot,
        placeholder: "sk-ant-xxxxxxxxxxxxxxxx",
        description: "For Claude models",
    },
    morph_api_key: {
        label: "Morph Cloud API Key",
        icon: Cloud,
        placeholder: "morph_xxxxxxxxxxxxxxxx",
        description: "For remote VM provisioning",
    },
    apify_api_key: {
        label: "Apify API Key",
        icon: Bot,
        placeholder: "apify_api_xxxxxxxxxxxxxxxx",
        description: "For web scraping with Apify actors",
    },
    custom: {
        label: "Custom Secret",
        icon: Lock,
        placeholder: "your-secret-value",
        description: "User-defined secret",
    },
};

export function SecretsPanel() {
    const { userId } = useAuth();
    const [secrets, setSecrets] = useState<SecretStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showValue, setShowValue] = useState<string | null>(null);

    // Form state
    const [newSecretType, setNewSecretType] = useState<SecretType>("github_pat");
    const [newSecretValue, setNewSecretValue] = useState("");
    const [newSecretLabel, setNewSecretLabel] = useState("");

    // Convex actions
    const getSecretsStatus = useAction(api.user_system.secrets_node.getSecretsStatus);
    const saveSecret = useAction(api.user_system.secrets_node.saveSecret);
    const deleteSecret = useAction(api.user_system.secrets_node.deleteSecret);

    // Load secrets on mount
    useEffect(() => {
        if (userId) {
            loadSecrets();
        }
    }, [userId]);

    const loadSecrets = async () => {
        if (!userId) return;
        setIsLoading(true);
        try {
            const result = await getSecretsStatus({ userId });
            setSecrets(result);
        } catch (error) {
            console.error("Failed to load secrets:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveSecret = async () => {
        if (!userId || !newSecretValue.trim()) return;

        setIsSaving(true);
        try {
            await saveSecret({
                userId,
                secretType: newSecretType,
                value: newSecretValue,
                label: newSecretLabel || undefined,
            });

            // Reset form and reload
            setNewSecretValue("");
            setNewSecretLabel("");
            setShowAddForm(false);
            await loadSecrets();
        } catch (error) {
            console.error("Failed to save secret:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSecret = async (secretType: SecretType) => {
        if (!userId) return;

        try {
            await deleteSecret({ userId, secretType });
            await loadSecrets();
        } catch (error) {
            console.error("Failed to delete secret:", error);
        }
    };

    // Get available secret types (not yet added)
    const availableTypes = (Object.keys(SECRET_TYPE_INFO) as SecretType[]).filter(
        type => type === "custom" || !secrets.some(s => s.secretType === type)
    );

    if (!userId) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                Sign in to manage your secrets
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">API Keys & Secrets</span>
                </div>
                {!showAddForm && availableTypes.length > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddForm(true)}
                        className="h-7 text-xs"
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Secret
                    </Button>
                )}
            </div>

            {/* Info text */}
            <p className="text-xs text-muted-foreground">
                Secrets are encrypted at rest with AES-256. They&apos;re used by the system for accessing external services.
            </p>

            {/* Loading state */}
            {isLoading && (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            )}

            {/* Secrets list */}
            {!isLoading && secrets.length > 0 && (
                <div className="space-y-2">
                    {secrets.map((secret) => {
                        const info = SECRET_TYPE_INFO[secret.secretType];
                        const Icon = info.icon;
                        const isShowing = showValue === secret.secretType;

                        return (
                            <div
                                key={secret.secretType}
                                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border"
                            >
                                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">
                                            {secret.label || info.label}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            ({secret.secretType})
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <code className="text-xs font-mono text-muted-foreground">
                                            {secret.maskedValue}
                                        </code>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteSecret(secret.secretType)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Empty state */}
            {!isLoading && secrets.length === 0 && !showAddForm && (
                <div className="text-center py-6 border rounded-lg border-dashed">
                    <Key className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">No secrets configured</p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddForm(true)}
                        className="mt-3"
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        Add your first secret
                    </Button>
                </div>
            )}

            {/* Add secret form */}
            {showAddForm && (
                <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                    <div className="space-y-2">
                        <Label className="text-xs">Secret Type</Label>
                        <Select
                            value={newSecretType}
                            onValueChange={(v) => setNewSecretType(v as SecretType)}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {availableTypes.map((type) => {
                                    const info = SECRET_TYPE_INFO[type];
                                    const Icon = info.icon;
                                    return (
                                        <SelectItem key={type} value={type}>
                                            <div className="flex items-center gap-2">
                                                <Icon className="h-3.5 w-3.5" />
                                                <span>{info.label}</span>
                                            </div>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {SECRET_TYPE_INFO[newSecretType].description}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs">Value</Label>
                        <Input
                            type="password"
                            value={newSecretValue}
                            onChange={(e) => setNewSecretValue(e.target.value)}
                            placeholder={SECRET_TYPE_INFO[newSecretType].placeholder}
                            className="h-8 text-xs font-mono"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs">Label (optional)</Label>
                        <Input
                            value={newSecretLabel}
                            onChange={(e) => setNewSecretLabel(e.target.value)}
                            placeholder="e.g., Work Account, Personal"
                            className="h-8 text-xs"
                        />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setShowAddForm(false);
                                setNewSecretValue("");
                                setNewSecretLabel("");
                            }}
                            className="h-7 text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSaveSecret}
                            disabled={!newSecretValue.trim() || isSaving}
                            className="h-7 text-xs"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Encrypting...
                                </>
                            ) : (
                                <>
                                    <Lock className="h-3 w-3 mr-1" />
                                    Save Secret
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

