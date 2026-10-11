import ExpoQuickLook from '@magrinj/expo-quick-look';
import { Image } from 'expo-image';
import { File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Artifact, artifactUri, loadArtifacts } from '../../artifacts';
import { FilenameTitle } from '../../components/FilenameTitle';
import { colors } from '../../theme';

function hasInlinePreview(item: Artifact): boolean {
  return item.type === 'pdf' || /\.mov$/i.test(item.originalName) ||
    (item.type === 'document' && /\.(docx|xlsx|pptx)$/i.test(item.originalName));
}

export default function ArtifactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [opening, setOpening] = useState(false);
  const [previewAvailable, setPreviewAvailable] = useState(true);
  const [imageViewport, setImageViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const found = (await loadArtifacts()).find((item) => item.id === id);
        if (active && found) setArtifact(found);
        if (!found || !new File(artifactUri(found)).exists) {
          if (active) setStatus('unavailable');
          return;
        }
        if (found.type === 'text' || found.type === 'markdown') {
          const contents = await new File(artifactUri(found)).text();
          if (active) setTextContent(contents);
        }
        if (active) {
          setStatus('ready');
        }
      } catch {
        if (active) setStatus('unavailable');
      }
    }
    void load();
    return () => { active = false; };
  }, [id]);

  async function openPreview(item: Artifact) {
    if (opening) return;
    setOpening(true);
    try {
      const uri = artifactUri(item);
      if (!(await ExpoQuickLook.canPreview(uri))) {
        setPreviewAvailable(false);
        return;
      }
      await ExpoQuickLook.previewFile({ uri, editingMode: 'disabled' });
    } catch {
      setPreviewAvailable(false);
    } finally {
      setOpening(false);
    }
  }

  useEffect(() => {
    if (!artifact || artifact.type === 'text' || artifact.type === 'markdown' || artifact.type === 'image' || hasInlinePreview(artifact)) return;
    const timer = setTimeout(() => { void openPreview(artifact); }, 300);
    return () => clearTimeout(timer);
    // Preview once when the artifact has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact?.id]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.headerButton}>Back</Text>
        </Pressable>
        <FilenameTitle name={artifact?.originalName ?? ''} />
        <View style={styles.headerSpacer} />
      </View>

      {status === 'loading' ? (
        <ActivityIndicator style={styles.center} color={colors.text} />
      ) : status === 'unavailable' || !artifact ? (
        <View style={styles.center}>
          <Text style={styles.message}>Preview unavailable</Text>
        </View>
      ) : artifact.type === 'text' || artifact.type === 'markdown' ? (
        <ScrollView contentContainerStyle={styles.textBody}>
          <Text selectable style={styles.documentText}>{textContent}</Text>
        </ScrollView>
      ) : artifact.type === 'image' ? (
        <ScrollView
          style={styles.imageViewer}
          contentContainerStyle={styles.zoomContent}
          onLayout={(event) => setImageViewport(event.nativeEvent.layout)}
          minimumZoomScale={1}
          maximumZoomScale={4}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          {imageViewport.width > 0 && imageViewport.height > 0 ? (
            <Image
              source={{ uri: artifactUri(artifact) }}
              style={{ width: imageViewport.width, height: imageViewport.height }}
              contentFit="contain"
            />
          ) : null}
        </ScrollView>
      ) : hasInlinePreview(artifact) ? (
        <WebView
          source={{ uri: artifactUri(artifact) }}
          style={[styles.documentViewer, artifact.type === 'document' && { backgroundColor: '#FFFFFF' }]}
          originWhitelist={['file://*']}
          allowingReadAccessToURL={artifactUri(artifact)}
          onShouldStartLoadWithRequest={({ url }: { url: string }) => url.startsWith('file://') || url === 'about:blank'}
          renderError={() => (
            <View style={styles.center}>
              <Text style={styles.message}>Preview unavailable</Text>
            </View>
          )}
        />
      ) : (
        <View style={styles.center}>
          <Text style={styles.documentType}>{artifact.originalName.split('.').pop()?.toUpperCase() || 'FILE'}</Text>
          <Text style={styles.message} numberOfLines={3}>{artifact.originalName}</Text>
          {previewAvailable ? (
            <Pressable accessibilityRole="button" onPress={() => void openPreview(artifact)} style={styles.previewButton}>
              <Text style={styles.previewButtonText}>{opening ? 'Opening…' : 'Open preview'}</Text>
            </Pressable>
          ) : <Text style={styles.unavailable}>Preview unavailable</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { height: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerButton: { color: colors.fileType, fontWeight: '600', fontSize: 15 },
  headerSpacer: { width: 42 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { color: colors.muted, textAlign: 'center', fontSize: 16, marginHorizontal: 24 },
  imageViewer: { flex: 1 },
  zoomContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  documentViewer: { flex: 1, backgroundColor: colors.background },
  documentType: { fontWeight: '700', fontSize: 24, color: colors.fileType, marginBottom: 14 },
  previewButton: { marginTop: 20, marginBottom: 18, backgroundColor: colors.accent, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 22 },
  previewButtonText: { color: colors.accentText, fontWeight: '600', fontSize: 14 },
  unavailable: { marginTop: 22, color: colors.muted, fontSize: 14 },
  textBody: { paddingHorizontal: 22, paddingVertical: 22 },
  documentText: { fontSize: 16, lineHeight: 25, color: colors.text },
});
