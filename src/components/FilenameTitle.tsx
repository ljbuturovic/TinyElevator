import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function FilenameTitle({ name }: { name: string }) {
  const [truncated, setTruncated] = useState(false);
  const lastDot = name.lastIndexOf('.');
  const hasExtension = lastDot > 0 && lastDot < name.length - 1;

  return (
    <View style={styles.container} accessible accessibilityLabel={name}>
      <Text
        style={styles.measure}
        accessible={false}
        pointerEvents="none"
        onTextLayout={(event) => setTruncated(event.nativeEvent.lines.length > 1)}
      >
        {name}
      </Text>
      {truncated && hasExtension ? (
        <View style={styles.parts}>
          <Text style={styles.basename} numberOfLines={1} ellipsizeMode="clip">
            {name.slice(0, lastDot)}
          </Text>
          <Text style={styles.suffix} numberOfLines={1}>{`...${name.slice(lastDot)}`}</Text>
        </View>
      ) : (
        <Text style={styles.full} numberOfLines={1}>{name}</Text>
      )}
    </View>
  );
}

const titleText = { color: colors.text, fontWeight: '600' as const, fontSize: 15 };

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', minWidth: 0 },
  measure: { ...titleText, position: 'absolute', width: '100%', opacity: 0 },
  full: { ...titleText, textAlign: 'center' },
  parts: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  basename: { ...titleText, flexShrink: 1 },
  suffix: { ...titleText, flexShrink: 0 },
});
