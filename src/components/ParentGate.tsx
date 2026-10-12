import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { create } from 'zustand';

import { useT } from '@/lib/i18n';
import { hasPin, makeAdultQuestion, PIN_LENGTH, verifyPin } from '@/lib/pin';
import { palette, radius, shadow, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { PinPad } from './PinPad';

interface GateState {
  open: boolean;
  /** Incremented per request so the gate starts fresh every time. */
  session: number;
  resolve: ((ok: boolean) => void) | null;
  request: () => Promise<boolean>;
  finish: (ok: boolean) => void;
}

const useGate = create<GateState>()((set, get) => ({
  open: false,
  session: 0,
  resolve: null,
  request: () =>
    new Promise<boolean>((resolve) => {
      get().resolve?.(false);
      set((s) => ({ open: true, resolve, session: s.session + 1 }));
    }),
  finish: (ok) => {
    get().resolve?.(ok);
    set({ open: false, resolve: null });
  },
}));

/**
 * Ask for the parent PIN (or an adult question) before leaving the child mode,
 * changing settings, opening links or buying (spec 9, Apple Kids Category).
 */
export function requestParentAccess(): Promise<boolean> {
  return useGate.getState().request();
}

export function ParentGateHost() {
  const { open, session, finish } = useGate();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => finish(false)}>
      <View style={styles.backdrop}>{open ? <GateBody key={session} onFinish={finish} /> : null}</View>
    </Modal>
  );
}

function GateBody({ onFinish }: { onFinish: (ok: boolean) => void }) {
  const t = useT();
  const [mode, setMode] = useState<'loading' | 'pin' | 'question'>('loading');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState(() => makeAdultQuestion());

  useEffect(() => {
    let alive = true;
    hasPin()
      .then((exists) => alive && setMode(exists ? 'pin' : 'question'))
      .catch(() => alive && setMode('question'));
    return () => {
      alive = false;
    };
  }, []);

  const onPinChange = (next: string) => {
    setError(null);
    setValue(next);
    if (next.length !== PIN_LENGTH) return;
    verifyPin(next).then((ok) => {
      if (ok) onFinish(true);
      else {
        setError(t('gate.wrongPin'));
        setValue('');
      }
    });
  };

  const checkAnswer = () => {
    if (Number(value) === question.answer) onFinish(true);
    else {
      setError(t('gate.wrongAnswer'));
      setValue('');
      setQuestion(makeAdultQuestion());
    }
  };

  return (
    <View style={[styles.sheet, shadow.lifted]}>
      <AppText variant="overline" color={palette.inkSoft} align="center">
        🔒 {t('gate.title')}
      </AppText>
      {mode === 'pin' ? (
        <>
          <AppText variant="title" align="center">
            {t('gate.enterPin')}
          </AppText>
          <PinPad value={value} onChange={onPinChange} />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode('question');
              setValue('');
            }}>
            <AppText variant="label" color={palette.primary} align="center">
              {t('gate.forgot')}
            </AppText>
          </Pressable>
        </>
      ) : null}
      {mode === 'question' ? (
        <>
          <AppText variant="title" align="center">
            {t('gate.question', { a: question.a, b: question.b })}
          </AppText>
          <PinPad
            value={value}
            onChange={(next) => {
              setError(null);
              setValue(next);
            }}
            secret={false}
            maxLength={3}
          />
          <Button label={t('common.done')} onPress={checkAnswer} disabled={!value} />
        </>
      ) : null}
      {error ? (
        <AppText variant="label" color={palette.danger} align="center" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <Button label={t('common.cancel')} variant="ghost" onPress={() => onFinish(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,14,35,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: palette.bg,
    borderRadius: radius.xl,
    padding: space.xl,
    gap: space.md,
  },
});
