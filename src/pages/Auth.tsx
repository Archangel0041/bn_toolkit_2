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
  const { user, sendOtp, verifyOtp, signInWithGoogle } = useAuth();
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

  const handleGoogleSignUp = async () => {
    if (!inviteCode.trim()) {
      setErrors(prev => ({ ...prev, inviteCode: 'Invite code is required for Google sign up' }));
      toast({
        title: 'Invite code required',
        description: 'Please enter your invite code before signing up with Google.',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    const { error } = await signInWithGoogle(inviteCode.trim());
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
          title: 'Google sign up failed',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    setLoading(false);

    if (error) {
      toast({
        title: 'Google sign in failed',
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
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {loading ? 'Signing in...' : 'Sign in with Google'}
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
                  onClick={handleGoogleSignUp}
                  disabled={loading}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {loading ? 'Signing up...' : 'Sign up with Google'}
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
