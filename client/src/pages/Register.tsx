import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Mail, Lock, User } from "lucide-react";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { register, user } = useAuth();
  const [, navigate] = useLocation();

  if (user) {
    navigate("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await register(email, password, name);
      navigate("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl overflow-hidden shadow-lg shadow-sky-500/30 mb-4">
            <img src="/icon-512.png" alt="SÓI" className="w-full h-full object-cover" />
          </div>
          <div className="flex items-baseline gap-1 justify-center">
            <h1 className="font-display text-3xl text-sky-500">SÓI</h1>
            <h1 className="font-display text-3xl text-foreground">Task</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">Tạo tài khoản mới</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
          {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl">{error}</div>}

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Tên</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full bg-secondary rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Nguyễn Văn A" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full bg-secondary rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="email@example.com" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full bg-secondary rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Tối thiểu 6 ký tự" minLength={6} />
            </div>
          </div>

          <button type="submit"
            className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 font-semibold text-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all">
            Đăng Ký
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Đã có tài khoản? <Link href="/login" className="text-primary font-semibold hover:underline">Đăng nhập</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
