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

  // Password Recovery states
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'reset'>('request');
  const [generatedToken, setGeneratedToken] = useState('');
  const [enteredToken, setEnteredToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState('');

  React.useEffect(() => {
    setSelectedRole(initialRole);
  }, [initialRole]);

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setRecoverySuccess('');
    setError('');

    try {
      if (!recoveryEmail.trim()) {
        setError('O e-mail é obrigatório.');
        setRecoveryLoading(false);
        return;
      }

      const isRootAdmin = selectedRole === 'admin' && recoveryEmail.trim() === ADMIN_EMAIL;
      let userFound = isRootAdmin;

      if (!userFound) {
        // Search Firestore for users
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const q = query(
          collection(db, 'users'),
          where('email', '==', recoveryEmail.trim()),
          where('role', '==', selectedRole)
        );
        const snapshot = await getDocs(q);
        userFound = !snapshot.empty;
      }

      if (!userFound) {
        setError('E-mail não cadastrado para este perfil de usuário.');
        setRecoveryLoading(false);
        return;
      }

      // Generate a simple 6-digit confirmation token/code for demonstration/redefinition
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedToken(token);
      setRecoveryStep('reset');
    } catch (err) {
      console.error(err);
      setError('Erro ao processar a solicitação de recuperação.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setError('');

    try {
      if (enteredToken !== generatedToken) {
        setError('Código de confirmação incorreto.');
        setRecoveryLoading(false);
        return;
      }

      if (newPassword.length < 6) {
        setError('A nova senha deve ter no mínimo 6 caracteres.');
        setRecoveryLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('As senhas não coincidem.');
        setRecoveryLoading(false);
        return;
      }

      const { collection, query, where, getDocs, doc, updateDoc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');

      const isRootAdmin = selectedRole === 'admin' && recoveryEmail.trim() === ADMIN_EMAIL;

      if (isRootAdmin) {
        // Update root admin profile
        await setDoc(doc(db, 'users', 'admin_root'), {
          email: ADMIN_EMAIL,
          name: 'Administrador Central',
          role: 'admin',
          password: newPassword
        }, { merge: true });
      } else {
        const q = query(
          collection(db, 'users'),
          where('email', '==', recoveryEmail.trim()),
          where('role', '==', selectedRole)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docId = snapshot.docs[0].id;
          await updateDoc(doc(db, 'users', docId), { password: newPassword });
        }
      }

      setRecoverySuccess('Senha alterada com sucesso! Você já pode entrar com a nova senha.');
      setRecoveryStep('request');
      setRecoveryMode(false);
      setRecoveryEmail('');
      setEnteredToken('');
      setNewPassword('');
      setConfirmPassword('');
      setPassword('');
    } catch (err) {
      console.error(err);
      setError('Erro ao alterar a senha.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const isDirecao = selectedRole === 'admin';
      
      // Basic check for admin email
      if (isDirecao && email.trim() === ADMIN_EMAIL) {
        // Check local users collection for override
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const q = query(
          collection(db, 'users'), 
          where('email', '==', email.trim()),
          where('role', '==', 'admin')
        );
        const snapshot = await getDocs(q);
        let adminUser: UserProfile = {
          uid: 'admin_root',
          email: ADMIN_EMAIL,
          name: 'Administrador Central',
          role: 'admin'
        };

        if (!snapshot.empty) {
          const stored = snapshot.docs[0].data() as UserProfile;
          if (stored.password && stored.password !== password) {
            setError('Senha incorreta.');
            setLoading(false);
            return;
          }
          adminUser = { ...stored, uid: snapshot.docs[0].id };
        } else {
          // Fallback if no custom password is set yet
          if (password !== '123456' && password !== '') {
            setError('Senha incorreta do Administrador (Padrão: 123456 ou use Recuperação).');
            setLoading(false);
            return;
          }
        }

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
        <Card className="w-full max-w-xl border-0 shadow-2xl bg-white">
          <CardHeader>
            <Button 
              variant="ghost" 
              className="w-fit -ml-2 text-slate-500 mb-2" 
              onClick={() => {
                if (recoveryMode) {
                  setRecoveryMode(false);
                  setRecoveryStep('request');
                  setError('');
                } else if (initialRole) {
                  onBack?.();
                } else {
                  setSelectedRole(null);
                  setError('');
                }
              }}
            >
              ← Voltar
            </Button>
            <CardTitle className="text-2xl font-bold">
              {recoveryMode 
                ? 'Recuperar / Alterar Senha' 
                : `Entrar como ${selectedRole === 'admin' ? 'Administrador' : 'Motorista'}`}
            </CardTitle>
            <CardDescription>
              {recoveryMode 
                ? 'Insira as informações para redefinir o acesso' 
                : 'Use seu e-mail e senha cadastrados'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg font-medium">
                {error}
              </div>
            )}
            {recoverySuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-lg font-medium">
                {recoverySuccess}
              </div>
            )}

            {recoveryMode ? (
              recoveryStep === 'request' ? (
                <form onSubmit={handleRequestToken} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">E-mail Cadastrado</label>
                    <div className="relative max-w-md">
                      <span className="absolute left-3 top-3 text-slate-400">@</span>
                      <input 
                        type="email" 
                        required
                        maxLength={100}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="seu-email@sistema.com"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all" disabled={recoveryLoading}>
                    {recoveryLoading ? <Loader2 className="animate-spin w-5 h-5" /> : "Gerar Código de Segurança"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 font-medium">
                    <p className="font-bold mb-1">Demonstração Segura:</p>
                    <p>O seu código temporário de verificação gerado é: <strong className="text-sm select-all bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-800 tracking-wider font-mono">{generatedToken}</strong></p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Código de Confirmação</label>
                    <div className="relative max-w-sm">
                      <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        required
                        maxLength={6}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono tracking-widest text-center"
                        placeholder="123456"
                        value={enteredToken}
                        onChange={(e) => setEnteredToken(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nova Senha</label>
                    <div className="relative max-w-md">
                      <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input 
                        type="password" 
                        required
                        maxLength={100}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Mínimo 6 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Confirmar Nova Senha</label>
                    <div className="relative max-w-md">
                      <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input 
                        type="password" 
                        required
                        maxLength={100}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Repita a nova senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all" disabled={recoveryLoading}>
                    {recoveryLoading ? <Loader2 className="animate-spin w-5 h-5" /> : "Redefinir Senha"}
                  </Button>
                </form>
              )
            ) : (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">E-mail</label>
                  <div className="relative max-w-md">
                    <span className="absolute left-3 top-3 text-slate-400">@</span>
                    <input 
                      type="email" 
                      required
                      maxLength={100}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="exemplo@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium block text-slate-700">Senha</label>
                  <div className="relative max-w-md">
                    <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input 
                      type="password" 
                      required
                      maxLength={100}
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
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4">
      <Card className="w-full max-w-xl border-0 shadow-2xl bg-white/80 backdrop-blur-sm overflow-hidden">
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
