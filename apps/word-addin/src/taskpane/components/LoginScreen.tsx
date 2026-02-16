/**
 * Login Screen for Word Add-in
 */

import * as React from 'react';
import { useState } from 'react';
import {
  makeStyles,
  tokens,
  Title1,
  Body1,
  Input,
  Button,
  Field,
  Spinner,
  MessageBar,
  MessageBarBody,
  Link,
} from '@fluentui/react-components';
import { LockClosedRegular, PersonRegular } from '@fluentui/react-icons';
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
  footer: {
    marginTop: tokens.spacingVerticalXL,
    textAlign: 'center',
  },
});

export const LoginScreen: React.FC = () => {
  const styles = useStyles();
  const { login, isLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.logo}>
        <img src="/icons/logo-large.svg" alt="ConTigo" width={80} height={80} />
        <Title1>ConTigo</Title1>
        <Body1>Contract Generation</Body1>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        <Field label="Email" required className={styles.field}>
          <Input
            type="email"
            value={email}
            onChange={(e, data) => setEmail(data.value)}
            contentBefore={<PersonRegular />}
            placeholder="your@email.com"
            disabled={isLoading}
          />
        </Field>

        <Field label="Password" required className={styles.field}>
          <Input
            type="password"
            value={password}
            onChange={(e, data) => setPassword(data.value)}
            contentBefore={<LockClosedRegular />}
            placeholder="••••••••"
            disabled={isLoading}
          />
        </Field>

        <Button
          type="submit"
          appearance="primary"
          disabled={isLoading || !email || !password}
        >
          {isLoading ? <Spinner size="tiny" /> : 'Sign In'}
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
