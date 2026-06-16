import React, { useState } from 'react';
import { auth } from '../firebase';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Bus, Key, Loader2, ShieldCheck, UserCheck } from 'lucide-react';
import { UserProfile } from '../types';

interface DriverAuthProps {
  onAuthSuccess: (user: UserProfile) => void;
  initialRole?: 'admin' | 'driver' | null;
  onBack?: () => void;
}

const ADMIN_EMAIL = 'emerson0712002@gmail.com';

export default function DriverAuth({ onAuthSuccess, initialRole = null, onBack }: DriverAuthProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'driver' | null>(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  React.useEffect(() => {
    setSelectedRole(initialRole);
  }, [initialRole]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const isDirecao = selectedRole === 'admin';
      
      // Basic check for admin email
      if (isDirecao && email.trim() === ADMIN_EMAIL) {
        const adminUser: UserProfile = {
          uid: 'admin_root',
          email: ADMIN_EMAIL,
          name: 'Administrador Central',
          role: 'admin'
        };
        localStorage.setItem('auth_user', JSON.stringify(adminUser));
        onAuthSuccess(adminUser);
        setLoading(false);
        return;
      }

      // Search for user in Firestore
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      const q = query(
        collection(db, 'users'), 
        where('email', '==', email.trim()),
        where('role', '==', selectedRole)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setError('Usuário não encontrado.');
        setLoading(false);
        return;
      }

      const userData = snapshot.docs[0].data() as UserProfile;
      
      // Validate password
      if (userData.password && userData.password !== password) {
        setError('Senha incorreta.');
        setLoading(false);
        return;
      }

      const finalUser = { ...userData, uid: snapshot.docs[0].id };
      localStorage.setItem('auth_user', JSON.stringify(finalUser));
      onAuthSuccess(finalUser);
    } catch (err) {
      console.error(err);
      setError('Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  if (selectedRole) {
    return (
      <div className="flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl bg-white">
          <CardHeader>
            <Button 
              variant="ghost" 
              className="w-fit -ml-2 text-slate-500 mb-2" 
              onClick={() => {
                if (initialRole) {
                  onBack?.();
                } else {
                  setSelectedRole(null);
                }
              }}
            >
              ← Voltar
            </Button>
            <CardTitle className="text-2xl font-bold">
              Entrar como {selectedRole === 'admin' ? 'Administrador' : 'Motorista'}
            </CardTitle>
            <CardDescription>Use seu e-mail e senha cadastrados</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg font-medium">
                {error}
              </div>
            )}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">E-mail</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400">@</span>
                  <input 
                    type="email" 
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="exemplo@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Senha</label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input 
                    type="password" 
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all" disabled={loading}>
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Acessar Painel"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl bg-white/80 backdrop-blur-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600"></div>
        <CardHeader className="space-y-1 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-slate-50 rounded-full ring-8 ring-slate-100/50">
              <Bus className="w-10 h-10 text-slate-900" />
            </div>
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight text-slate-900">
            Acesso ao Sistema
          </CardTitle>
          <CardDescription className="text-slate-500 font-medium">
            Selecione seu perfil para entrar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <Button 
              type="button" 
              variant="outline" 
              className="h-24 border-2 border-purple-100 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 hover:bg-purple-50 hover:border-purple-300 hover:scale-[1.02] active:scale-95 transition-all group" 
              onClick={() => setSelectedRole('admin')}
              disabled={loading}
            >
              <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                <ShieldCheck className="w-6 h-6 text-purple-700" />
              </div>
              <div className="flex flex-col">
                <span className="text-purple-900 text-lg">Área do Admin</span>
                <span className="text-purple-500 text-[10px] font-normal uppercase tracking-wider">Gestão Administrativa</span>
              </div>
            </Button>

            <Button 
              type="button" 
              variant="outline" 
              className="h-24 border-2 border-blue-100 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 hover:bg-blue-50 hover:border-blue-300 hover:scale-[1.02] active:scale-95 transition-all group" 
              onClick={() => setSelectedRole('driver')}
              disabled={loading}
            >
              <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <UserCheck className="w-6 h-6 text-blue-700" />
              </div>
              <div className="flex flex-col">
                <span className="text-blue-900 text-lg">Painel do Motorista</span>
                <span className="text-blue-500 text-[10px] font-normal uppercase tracking-wider">Acesso às Rotas</span>
              </div>
            </Button>
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50/50 p-6 flex justify-center">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-[0.2em] text-center">
            Escolha uma opção acima
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
