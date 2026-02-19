/**
 * Login Screen for Word Add-in
 * Supports ConTigo email/password or Microsoft Office SSO.
 */

import * as React from 'react';
import { useState } from 'react';
import {
  makeStyles,
  tokens,
  Title1,
  Body1,
  Caption1,
  Input,
  Button,
  Field,
  Spinner,
  MessageBar,
  MessageBarBody,
  Link,
  Divider,
} from '@fluentui/react-components';
import { LockClosedRegular, PersonRegular } from '../../utils/icons';
import { useAuth } from '../contexts/AuthContext';



const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: tokens.spacingHorizontalXL,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  logo: {
    marginBottom: tokens.spacingVerticalXL,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalS,
  },
  form: {
    width: '100%',
    maxWidth: '300px',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  divider: {
    width: '100%',
    maxWidth: '300px',
    marginTop: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalM,
  },
  ssoSection: {
    width: '100%',
    maxWidth: '300px',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    alignItems: 'center',
  },
  ssoButton: {
    width: '100%',
  },
  footer: {
    marginTop: tokens.spacingVerticalXL,
    textAlign: 'center',
  },
});

export const LoginScreen: React.FC = () => {
  const styles = useStyles();
  const { login, loginWithMicrosoft, ssoAvailable, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ssoLoading, setSsoLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || 'Login failed');
    }
  };

  const handleMicrosoftSSO = async () => {
    setError(null);
    setSsoLoading(true);
    try {
      const result = await loginWithMicrosoft();
      if (!result.success) {
        if (result.needsConsent) {
          setError('Your admin needs to consent to ConTigo for your organisation. Contact your IT administrator.');
        } else {
          setError(result.error || 'Microsoft sign-in failed. Try email/password below.');
        }
      }
    } finally {
      setSsoLoading(false);
    }
  };

  const anyLoading = isLoading || ssoLoading;

  return (
    <div className={styles.root}>
      <div className={styles.logo}>
        <img src="/icons/logo-large.svg" alt="ConTigo" width={80} height={80} />
        <Title1>ConTigo</Title1>
        <Body1>Contract Generation</Body1>
      </div>

      {error && (
        <div style={{ width: '100%', maxWidth: '300px', marginBottom: tokens.spacingVerticalM }}>
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        </div>
      )}

      {/* Microsoft SSO — shown when running inside Office */}
      {ssoAvailable && (
        <div className={styles.ssoSection}>
          <Button
            appearance="primary"
            size="large"
            className={styles.ssoButton}
            disabled={anyLoading}
            onClick={handleMicrosoftSSO}
            icon={ssoLoading ? <Spinner size="tiny" /> : undefined}
          >
            {ssoLoading ? 'Signing in...' : 'Sign in with Microsoft'}
          </Button>
          <Caption1>Use your Microsoft 365 account</Caption1>
        </div>
      )}

      {ssoAvailable && (
        <div className={styles.divider}>
          <Divider>or sign in with email</Divider>
        </div>
      )}

      {/* Email/password form */}
      <form className={styles.form} onSubmit={handleSubmit}>
        <Field label="Email" required className={styles.field}>
          <Input
            type="email"
            value={email}
            onChange={(e, data) => setEmail(data.value)}
            contentBefore={<PersonRegular />}
            placeholder="your@email.com"
            disabled={anyLoading}
          />
        </Field>

        <Field label="Password" required className={styles.field}>
          <Input
            type="password"
            value={password}
            onChange={(e, data) => setPassword(data.value)}
            contentBefore={<LockClosedRegular />}
            placeholder="••••••••"
            disabled={anyLoading}
          />
        </Field>

        <Button
          type="submit"
          appearance={ssoAvailable ? 'secondary' : 'primary'}
          disabled={anyLoading || !email || !password}
        >
          {isLoading ? <Spinner size="tiny" /> : 'Sign In with Email'}
        </Button>
      </form>

      <div className={styles.footer}>
        <Body1>
          Don't have an account?{' '}
          <Link href="https://contigo.app/auth/signup" target="_blank">
            Sign up at contigo.app
          </Link>
        </Body1>
      </div>
    </div>
  );
};
