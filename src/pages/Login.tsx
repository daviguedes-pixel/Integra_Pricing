import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, Sparkles, Fuel, TrendingUp, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";


export default function Login() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [logoSrc, setLogoSrc] = useState<string>(
    "/lovable-uploads/integra-logo-login.png"
  );
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Por favor, preencha todos os campos");
      return;
    }

    setLoading(true);
    try {
      const { error, data } = await signIn(email, password) as any;
      if (error) {
        toast.error("Erro no login: " + (error.message || "Credenciais inválidas"));
      } else {
        // Se usuário entrou com a senha padrão, forçar troca de senha
        if (password === "sr123" || password === "SR@123") {
          toast.message("Senha padrão detectada", { description: "Defina uma nova senha para continuar." });
          navigate("/change-password", { replace: true });
          return;
        }
        toast.success("Login realizado com sucesso!");
      }
    } catch (error) {
      toast.error("Erro inesperado no login");
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything if user is already logged in
  if (user) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">

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
      <div className="absolute inset-0 bg-grid-slate-800/[0.05] bg-[bottom_1px_center] pointer-events-none" />

      {/* Glow effect atrás do card - estático para melhor performance */}
      <div className="absolute w-[500px] h-[500px] bg-gradient-to-r from-blue-500/15 via-purple-500/15 to-pink-500/15 rounded-full blur-2xl opacity-60" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo Section com animação */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="mb-2 flex flex-col items-center justify-center relative">
            {/* Decorative glow behind logo - estático para melhor performance */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-40 h-40 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-xl opacity-50" />
            </div>

            {/* Logo com efeito de hover */}
            <motion.div
              className="relative flex justify-center"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <motion.img
                src={logoSrc}
                alt="Integra Logo"
                className="h-[160px] drop-shadow-2xl"
                initial={{ opacity: 0, scale: 0.8, rotateY: -15 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                onError={(e) => {
                  if (logoSrc.includes('integra-logo-login')) {
                    setLogoSrc('/lovable-uploads/integra-logo-symbol.png');
                  } else if (logoSrc.includes('integra-logo-symbol')) {
                    setLogoSrc('/lovable-uploads/integra-logo.png');
                  }
                }}
              />
            </motion.div>

            {/* Título com gradiente animado */}
            <motion.h1
              className="text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent drop-shadow-lg mt-2 font-righteous"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              Integra
            </motion.h1>

            {/* Subtítulo animado */}
            <motion.p
              className="text-white/70 text-sm mt-1 tracking-wider"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              Gestão Inteligente de Preços
            </motion.p>
          </div>
        </motion.div>

        {/* Card com glassmorphism e animação de entrada */}
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        >
          <Card className="shadow-2xl border border-white/20 bg-white/95 backdrop-blur-xl overflow-hidden relative">
            {/* Borda brilhante - estática para melhor performance */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

            <CardHeader className="space-y-2 pb-6 relative">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <CardTitle className="text-2xl text-center text-gray-800 font-bold flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  Fazer Login
                </CardTitle>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <CardDescription className="text-center text-gray-600">
                  Entre com suas credenciais
                </CardDescription>
              </motion.div>
            </CardHeader>

            <CardContent className="relative">
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Campo Email com animação de foco */}
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <Label htmlFor="email" className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                    <motion.div
                      animate={{
                        color: focusedField === 'email' ? '#3b82f6' : '#374151',
                        scale: focusedField === 'email' ? 1.1 : 1
                      }}
                    >
                      <Mail className="h-4 w-4" />
                    </motion.div>
                    E-mail
                  </Label>
                  <motion.div
                    whileFocus={{ scale: 1.02 }}
                    className="relative"
                  >
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@redesaoroque.com.br"
                      className={`h-12 text-base transition-all duration-300 ${focusedField === 'email'
                        ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg shadow-blue-500/20'
                        : ''
                        }`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      required
                      autoComplete="email"
                    />
                    <AnimatePresence>
                      {focusedField === 'email' && (
                        <motion.div
                          className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          exit={{ scaleX: 0 }}
                          transition={{ duration: 0.3 }}
                        />
                      )}
                    </AnimatePresence>
                  </motion.div>
                </motion.div>

                {/* Campo Senha com animação de foco */}
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  <Label htmlFor="password" className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                    <motion.div
                      animate={{
                        color: focusedField === 'password' ? '#3b82f6' : '#374151',
                        scale: focusedField === 'password' ? 1.1 : 1
                      }}
                    >
                      <Lock className="h-4 w-4" />
                    </motion.div>
                    Senha
                  </Label>
                  <motion.div className="relative">
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className={`h-12 text-base transition-all duration-300 ${focusedField === 'password'
                        ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg shadow-blue-500/20'
                        : ''
                        }`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      required
                      autoComplete="current-password"
                    />
                    <AnimatePresence>
                      {focusedField === 'password' && (
                        <motion.div
                          className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          exit={{ scaleX: 0 }}
                          transition={{ duration: 0.3 }}
                        />
                      )}
                    </AnimatePresence>
                  </motion.div>
                </motion.div>

                {/* Botão com animação */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                >
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 hover:from-slate-700 hover:via-slate-600 hover:to-slate-700 text-white font-semibold text-base shadow-lg transition-all duration-300 relative overflow-hidden group"
                      disabled={loading}
                    >
                      {/* Efeito de brilho no hover */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                      />

                      <AnimatePresence mode="wait">
                        {loading ? (
                          <motion.div
                            key="loading"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="flex items-center gap-2"
                          >
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                            />
                            Entrando...
                          </motion.div>
                        ) : (
                          <motion.span
                            key="text"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                          >
                            Entrar no Sistema
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Button>
                  </motion.div>
                </motion.div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer com animação */}
        <motion.p
          className="text-center text-sm text-white/90 mt-8 drop-shadow-lg font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          © 2025 Rede São Roque. Todos os direitos reservados.
        </motion.p>
      </div>
    </div>
  );
}