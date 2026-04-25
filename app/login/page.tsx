"use client";

import React, { useState } from 'react';
import { useAuth } from '@/hooks/AuthProvider';
import { useRouter } from 'next/navigation';
import { Card, TextField, Label, Input, Button, FieldError } from '@heroui/react';

export default function LoginPage() {
  const { loginWithGoogle, loginWithEmail, signupWithEmail, user, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white bg-black">Loading...</div>;

  if (user) {
    router.push('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (isSignUp) {
        await signupWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
      router.push('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogle = async () => {
    try {
      await loginWithGoogle();
      router.push('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: `url('/bg-images/vlcsnap-00001.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <Card className="relative z-10 w-full max-w-md p-8 bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl">
        <Card.Header>
          <Card.Title className="text-4xl text-center mb-8 font-heading text-white tracking-wider w-full">
            {isSignUp ? "Join the Ledger" : "Welcome Back"}
          </Card.Title>
        </Card.Header>

        <Card.Content className="flex flex-col gap-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <TextField isRequired isInvalid={!!error} className="flex flex-col gap-2">
              <Label className="text-zinc-400 text-sm font-semibold px-1">Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e: any) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-black/50 border border-white/20 text-white placeholder-zinc-400 focus:outline-none focus:border-amber-500 font-body transition-colors"
                placeholder="email@example.com"
              />
            </TextField>

            <TextField isRequired isInvalid={!!error} className="flex flex-col gap-2">
              <Label className="text-zinc-400 text-sm font-semibold px-1">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e: any) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-black/50 border border-white/20 text-white placeholder-zinc-400 focus:outline-none focus:border-amber-500 font-body transition-colors"
                placeholder="••••••••"
              />
              {error && <FieldError className="text-red-400 text-sm mt-1">{error}</FieldError>}
            </TextField>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full py-4 mt-2 bg-gradient-to-r from-amber-600 to-yellow-500 text-white font-bold tracking-wide hover:from-amber-500 hover:to-yellow-400 transition-all shadow-[0_0_15px_rgba(245,158,11,0.4)]"
            >
              {isSignUp ? "Sign Up" : "Log In"}
            </Button>
          </form>

          <div className="flex items-center gap-4 py-2">
            <div className="h-[1px] flex-1 bg-white/20" />
            <span className="text-zinc-400 text-sm">OR</span>
            <div className="h-[1px] flex-1 bg-white/20" />
          </div>

          <Button
            variant="outline"
            size="lg"
            onPress={handleGoogle}
            className="w-full py-4 bg-white text-zinc-900 font-bold tracking-wide hover:bg-zinc-200 transition-colors flex items-center justify-center gap-3"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
            Continue with Google
          </Button>

          <div className="mt-4 text-center text-zinc-400 font-body text-sm">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer outline-none"
            >
              {isSignUp ? "Log In" : "Sign Up"}
            </button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
