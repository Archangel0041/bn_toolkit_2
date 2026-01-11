import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { z } from 'zod';

const emailOrPhoneSchema = z.string().min(1, 'Email or phone is required').refine(
  (val) => {
    // Check if it's a valid email
    const emailResult = z.string().email().safeParse(val);
    if (emailResult.success) return true;
    // Check if it's a phone number (starts with +)
    if (val.startsWith('+') && val.length >= 10) return true;
    return false;
  },
  { message: 'Please enter a valid email or phone number (with country code, e.g., +1...)' }
);

const otpSchema = z.string().min(6, 'Code must be at least 6 digits').max(6, 'Code must be 6 digits');

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ emailOrPhone?: string; otpCode?: string; inviteCode?: string }>({});
  const [otpSent, setOtpSent] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const { user, sendOtp, verifyOtp, signInWithDiscord } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if there's an invite code in URL
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setInviteCode(code);
      setIsSignUp(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const validateEmailOrPhone = () => {
    const result = emailOrPhoneSchema.safeParse(emailOrPhone);
    if (!result.success) {
      setErrors({ emailOrPhone: result.error.errors[0]?.message });
      return false;
    }
    setErrors({});
    return true;
  };

  const validateOtp = () => {
    const result = otpSchema.safeParse(otpCode);
    if (!result.success) {
      setErrors({ otpCode: result.error.errors[0]?.message });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmailOrPhone()) return;
    
    // For sign up, require invite code
    if (isSignUp && !inviteCode.trim()) {
      setErrors(prev => ({ ...prev, inviteCode: 'Invite code is required' }));
      return;
    }
    
    setLoading(true);
    const { error } = await sendOtp(emailOrPhone, isSignUp ? inviteCode.trim() : undefined);
    setLoading(false);

    if (error) {
      if (error.message.includes('invite code')) {
        toast({
          title: 'Invalid invite code',
          description: 'The invite code is invalid, expired, or has already been used.',
          variant: 'destructive',
        });
      } else if (error.message.includes('Signups not allowed')) {
        toast({
          title: 'Account not found',
          description: 'No account exists with this email/phone. Please sign up first.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Failed to send code',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      setOtpSent(true);
      toast({
        title: 'Code sent!',
        description: `We sent a verification code to ${emailOrPhone}.`,
      });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateOtp()) return;
    
    setLoading(true);
    const { error } = await verifyOtp(emailOrPhone, otpCode);
    setLoading(false);

    if (error) {
      toast({
        title: 'Verification failed',
        description: 'Invalid or expired code. Please try again.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Welcome!',
        description: 'You have been signed in successfully.',
      });
      navigate('/');
    }
  };

  const handleDiscordSignUp = async () => {
    if (!inviteCode.trim()) {
      setErrors(prev => ({ ...prev, inviteCode: 'Invite code is required for Discord sign up' }));
      toast({
        title: 'Invite code required',
        description: 'Please enter your invite code before signing up with Discord.',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    const { error } = await signInWithDiscord(inviteCode.trim());
    setLoading(false);

    if (error) {
      if (error.message.includes('invite code')) {
        toast({
          title: 'Invalid invite code',
          description: 'The invite code is invalid, expired, or has already been used.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Discord sign up failed',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  };

  const handleDiscordSignIn = async () => {
    setLoading(true);
    const { error } = await signInWithDiscord();
    setLoading(false);

    if (error) {
      toast({
        title: 'Discord sign in failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setOtpSent(false);
    setOtpCode('');
    setErrors({});
  };

  // OTP verification step
  if (otpSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Enter verification code</CardTitle>
            <CardDescription>
              We sent a 6-digit code to <strong>{emailOrPhone}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp-code">Verification Code</Label>
                <Input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={loading}
                  className="text-center text-2xl tracking-widest"
                  autoFocus
                />
                {errors.otpCode && <p className="text-sm text-destructive">{errors.otpCode}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </Button>
            </form>
            <div className="mt-4 text-center space-y-2">
              <Button 
                variant="link" 
                onClick={() => handleSendOtp({ preventDefault: () => {} } as React.FormEvent)}
                disabled={loading}
              >
                Resend code
              </Button>
              <br />
              <Button variant="link" onClick={resetForm}>
                ← Use different email/phone
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Battle Nations Toolkit</CardTitle>
          <CardDescription>Sign in to access upload features</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={isSignUp ? 'signup' : 'signin'} onValueChange={(v) => setIsSignUp(v === 'signup')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <div className="space-y-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full flex items-center justify-center gap-2"
                  onClick={handleDiscordSignIn}
                  disabled={loading}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  {loading ? 'Signing in...' : 'Sign in with Discord'}
                </Button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or with email/phone</span>
                  </div>
                </div>
                
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email or Phone</Label>
                    <Input
                      id="signin-email"
                      type="text"
                      placeholder="you@example.com or +1234567890"
                      value={emailOrPhone}
                      onChange={(e) => setEmailOrPhone(e.target.value)}
                      disabled={loading}
                    />
                    {errors.emailOrPhone && <p className="text-sm text-destructive">{errors.emailOrPhone}</p>}
                    <p className="text-xs text-muted-foreground">
                      We'll send you a one-time code to sign in.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Sending code...' : 'Send Sign In Code'}
                  </Button>
                </form>
              </div>
            </TabsContent>
            
            <TabsContent value="signup">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-invite">Invite Code</Label>
                  <Input
                    id="signup-invite"
                    type="text"
                    placeholder="Enter your invite code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    disabled={loading}
                  />
                  {errors.inviteCode && <p className="text-sm text-destructive">{errors.inviteCode}</p>}
                </div>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full flex items-center justify-center gap-2"
                  onClick={handleDiscordSignUp}
                  disabled={loading}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  {loading ? 'Signing up...' : 'Sign up with Discord'}
                </Button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or with email/phone</span>
                  </div>
                </div>
                
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email or Phone</Label>
                    <Input
                      id="signup-email"
                      type="text"
                      placeholder="you@example.com or +1234567890"
                      value={emailOrPhone}
                      onChange={(e) => setEmailOrPhone(e.target.value)}
                      disabled={loading}
                    />
                    {errors.emailOrPhone && <p className="text-sm text-destructive">{errors.emailOrPhone}</p>}
                    <p className="text-xs text-muted-foreground">
                      We'll send you a one-time code to verify your account.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Sending code...' : 'Send Verification Code'}
                  </Button>
                </form>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="mt-4 text-center">
            <Button variant="link" onClick={() => navigate('/')}>
              ← Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
