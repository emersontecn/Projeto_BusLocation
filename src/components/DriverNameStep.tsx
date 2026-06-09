import { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { User, CheckCircle2, ArrowRight } from 'lucide-react';
import { UserProfile } from '../types';

interface DriverNameStepProps {
  user: UserProfile;
  onComplete: (updatedUser: UserProfile) => void;
  serviceConfig?: { type: string, entity?: string };
}

export default function DriverNameStep({ user, onComplete, serviceConfig }: DriverNameStepProps) {
  const [name, setName] = useState(user.name === 'Direção' || user.name === 'Direção (emerson)' ? '' : (user.name || ''));
  const [loading, setLoading] = useState(false);

  const handleStartShift = async () => {
    if (!name.trim()) return;
    setLoading(true);

    try {
      // 1. Update user profile name if changed
      const updatedUser = { ...user, name: name.trim() };
      await setDoc(doc(db, 'users', user.uid), updatedUser);

      // 2. Create a shift log entry for history
      await addDoc(collection(db, 'shifts'), {
        driverId: user.uid,
        driverName: name.trim(),
        startTime: serverTimestamp(),
        date: new Date().toISOString().split('T')[0]
      });

      onComplete(updatedUser);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-green-100 rounded-full">
              <User className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-black text-slate-900">Identificação</CardTitle>
          <CardDescription>
            Confirme seu nome para iniciar o registro da rota de hoje.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="driver-name">Nome do Motorista:</Label>
            <Input 
              id="driver-name"
              placeholder="Digite seu nome..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 text-lg border-slate-200"
            />
          </div>
          
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Este nome será exibido para os alunos e salvo no histórico de motoristas do dia.
            </p>
          </div>

          <Button 
            onClick={handleStartShift} 
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-lg font-bold rounded-xl"
            disabled={!name.trim() || loading}
          >
            Começar a Dirigir <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
