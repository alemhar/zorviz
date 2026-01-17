import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth";
import { Button, Input, Label, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@zorviz/ui";
import { Wrench, Shield, Key } from "lucide-react";

export default function LoginPage() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<"admin" | "advisor" | "mechanic">("admin");
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // Simulate delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await login(email, role);
        setIsLoading(false);
        navigate("/");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-primary/10 rounded-full">
                            <Wrench className="w-8 h-8 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
                    <CardDescription className="text-center">
                        Enter your credentials to access the workspace
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-4">

                        <div className="space-y-2">
                            <Label>Select Role</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {(["admin", "advisor", "mechanic"] as const).map((r) => (
                                    <div
                                        key={r}
                                        onClick={() => setRole(r)}
                                        className={`cursor-pointer border rounded-md p-2 flex flex-col items-center gap-2 transition-colors ${role === r
                                                ? "bg-primary/10 border-primary text-primary"
                                                : "hover:bg-muted"
                                            }`}
                                    >
                                        {r === "admin" && <Shield className="w-4 h-4" />}
                                        {r === "advisor" && <Key className="w-4 h-4" />}
                                        {r === "mechanic" && <Wrench className="w-4 h-4" />}
                                        <span className="text-xs font-medium capitalize">{r}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                placeholder="Ex. mechanics@zorviz.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" type="submit" disabled={isLoading}>
                            {isLoading ? "Signing in..." : "Sign In"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
