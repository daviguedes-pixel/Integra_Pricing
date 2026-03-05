import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaoRoqueLogo } from "@/components/SaoRoqueLogo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function ForgotPassword() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const navigate = useNavigate();

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) {
            toast.error("Por favor, insira seu e-mail");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                // Redireciona de volta para a aplicação, para a página de alteração de senha
                redirectTo: `${window.location.origin}/change-password`,
            });

            if (error) {
                if (error.message.includes("not found")) {
                    toast.error("E-mail não encontrado no sistema.");
                } else if (error.message.includes("rate limit")) {
                    toast.error("Muitas tentativas. Tente novamente mais tarde.");
                } else {
                    toast.error("Erro ao enviar e-mail: " + error.message);
                }
                return;
            }

            setSubmitted(true);
            toast.success("E-mail de recuperação enviado com sucesso!");
        } catch (error) {
            toast.error("Erro inesperado ao solicitar recuperação");
            console.error("Password reset error:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden p-4">

            {/* Background Image com overlay animado - Reduced opacity */}
            <motion.div
                className="absolute inset-0 bg-cover bg-center opacity-30"
                style={{
                    backgroundImage: `url('/lovable-uploads/b72ab13f-d8c6-4300-9059-7bf26de48e79.png')`,
                }}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
            />

            {/* Background simplificado sem bolas brilhantes */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900/60 via-slate-800/50 to-slate-900/60 backdrop-blur-[2px]" />

            <div className="w-full max-w-md relative z-10">
                {/* Logo Section com animação */}
                <motion.div
                    className="text-center mb-8"
                    initial={{ opacity: 0, y: -50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                >
                    <div className="mb-2 flex flex-col items-center justify-center relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-32 h-32 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full blur-2xl" />
                        </div>
                        <div className="relative">
                            <motion.img
                                src='/lovable-uploads/integra-logo-symbol.png'
                                alt="Integra Logo"
                                className="h-[160px] drop-shadow-2xl"
                                initial={{ opacity: 0, scale: 0.8, rotateY: -15 }}
                                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                            />
                        </div>

                        <motion.h1
                            className="text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent drop-shadow-lg mt-2 font-righteous"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                        >
                            Integra
                        </motion.h1>

                    </div>
                </motion.div>

                {/* Card com glassmorphism e animação de entrada */}
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                >
                    <Card className="shadow-2xl border border-white/20 bg-white/95 backdrop-blur-xl overflow-hidden relative">
                        <CardHeader className="space-y-1 pb-6 relative z-10 pt-8">
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2">
                                Recuperar Senha
                            </h2>
                            {!submitted && (
                                <CardDescription className="text-center text-slate-500 font-medium">
                                    Enviaremos um link de recuperação para o seu e-mail
                                </CardDescription>
                            )}
                        </CardHeader>
                        <CardContent className="relative z-10 pb-8 px-8">

                            {submitted ? (
                                <motion.div
                                    className="text-center space-y-6"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Mail className="w-8 h-8" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-slate-800">E-mail Enviado!</h3>
                                        <p className="text-slate-600 text-sm">
                                            Verifique a caixa de entrada do e-mail <br /><span className="font-semibold text-slate-800">{email}</span>
                                            <br />para redefinir sua senha. Se não encontrar, verifique a pasta de spam.
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="w-full mt-4 h-12"
                                        onClick={() => navigate('/login')}
                                    >
                                        Voltar para o Login
                                    </Button>
                                </motion.div>
                            ) : (
                                <form onSubmit={handleResetPassword} className="space-y-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                                            E-mail corporativo
                                        </Label>
                                        <div className="relative group">
                                            <Mail className="absolute left-3 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder="seu.email@redesaoroque.com.br"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="pl-10 h-12 bg-white/50 border-slate-200 focus:border-blue-500 focus:ring-blue-500 transition-all duration-300 text-slate-800"
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full h-12 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 text-white font-semibold text-base shadow-lg hover:shadow-xl transition-all duration-300 group"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            "Enviar link de recuperação"
                                        )}
                                    </Button>

                                    <div className="text-center mt-6">
                                        <Link
                                            to="/login"
                                            className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors inline-flex items-center gap-2"
                                        >
                                            <ArrowLeft className="w-4 h-4" /> Voltar para o Login
                                        </Link>
                                    </div>
                                </form>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Footer */}
                <motion.div
                    className="text-center text-sm text-white/50 mt-8 font-medium tracking-wide"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                >
                    <p>© 2026 Rede São Roque. Todos os direitos reservados.</p>
                </motion.div>
            </div>
        </div>
    );
}
