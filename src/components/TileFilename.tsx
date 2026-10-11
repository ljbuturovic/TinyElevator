import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type Fit =
  | { mode: 'full' }
  | { mode: 'search'; low: number; high: number; probe: number; best: number }
  | { mode: 'done'; prefixLength: number | null };

export function TileFilename({ name }: { name: string }) {
  const [fit, setFit] = useState<Fit>({ mode: 'full' });
  const lastDot = name.lastIndexOf('.');
  const hasExtension = lastDot > 0 && lastDot < name.length - 1;
  const basename = Array.from(name.slice(0, lastDot));
  const suffix = `...${name.slice(lastDot)}`;
  const candidate = (length: number) => basename.slice(0, length).join('') + suffix;

  function onMeasure(lines: number) {
    setFit((current) => {
      if (current.mode === 'full') {
        if (lines <= 2) return { mode: 'done', prefixLength: null };
        return { mode: 'search', low: 0, high: basename.length, probe: Math.floor(basename.length / 2), best: 0 };
      }
      if (current.mode !== 'search') return current;
      const fits = lines <= 2;
      const low = fits ? current.probe + 1 : current.low;
      const high = fits ? current.high : current.probe - 1;
      const best = fits ? current.probe : current.best;
      if (low > high) return { mode: 'done', prefixLength: best };
      return { mode: 'search', low, high, probe: Math.floor((low + high) / 2), best };
    });
  }

  if (!hasExtension) {
    return <Text style={styles.noExtension} numberOfLines={2}>{name}</Text>;
  }

  const measured = fit.mode === 'search' ? candidate(fit.probe) : name;
  const visible = fit.mode === 'done' && fit.prefixLength !== null ? candidate(fit.prefixLength) : name;

  return (
    <View style={styles.container}>
      {fit.mode !== 'done' && (
        <Text
          style={styles.measure}
          accessible={false}
          pointerEvents="none"
          onTextLayout={(event) => onMeasure(event.nativeEvent.lines.length)}
        >
          {measured}
        </Text>
      )}
      <Text style={styles.label} numberOfLines={2}>{visible}</Text>
    </View>
  );
}

const labelText = { fontSize: 12, lineHeight: 16, color: colors.text };

const styles = StyleSheet.create({
  container: { width: '100%', minHeight: 32, marginTop: 7 },
  label: labelText,
  noExtension: { ...labelText, marginTop: 7 },
  measure: { ...labelText, position: 'absolute', width: '100%', opacity: 0 },
});
