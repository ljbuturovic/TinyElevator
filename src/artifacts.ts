import { Directory, File, Paths } from 'expo-file-system';

export type ArtifactType = 'image' | 'pdf' | 'text' | 'markdown' | 'document' | 'other';

export type Artifact = {
  id: string;
  originalName: string;
  localName: string;
  mimeType?: string;
  type: ArtifactType;
  addedAt: string;
};

export type PickedArtifact = {
  uri: string;
  name: string;
  mimeType?: string;
  // Photo picker output can use a different format than the library filename.
  storedExtension?: string;
};

const files = new Directory(Paths.document, 'artifacts');
const index = new File(Paths.document, 'artifacts.json');

function extension(name: string): string {
  const match = /\.([a-z0-9]{1,12})$/i.exec(name);
  return match?.[1]?.toLowerCase() ?? '';
}

export function artifactType(name: string, mimeType?: string): ArtifactType {
  const ext = extension(name);
  if (mimeType?.startsWith('image/') || /^(heic|heif|jpg|jpeg|png|gif|webp|bmp|tif|tiff)$/.test(ext)) return 'image';
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (ext === 'md' || ext === 'markdown' || mimeType === 'text/markdown') return 'markdown';
  if (ext === 'txt' || mimeType === 'text/plain') return 'text';
  if (/^(ppt|pptx|doc|docx|xls|xlsx|pages|numbers|key|rtf)$/.test(ext)) return 'document';
  return 'other';
}

export function artifactUri(artifact: Artifact): string {
  return new File(files, artifact.localName).uri;
}

export async function loadArtifacts(): Promise<Artifact[]> {
  if (!index.exists) return [];
  const parsed: unknown = JSON.parse(await index.text());
  if (!Array.isArray(parsed) || !parsed.every((item) =>
    item && typeof item === 'object' &&
    typeof item.id === 'string' &&
    typeof item.originalName === 'string' &&
    typeof item.localName === 'string' &&
    typeof item.type === 'string' &&
    typeof item.addedAt === 'string'
  )) {
    throw new Error('The saved artifact index is unreadable.');
  }
  return parsed as Artifact[];
}

function saveIndex(artifacts: Artifact[]): void {
  const pending = new File(Paths.document, 'artifacts.json.tmp');
  pending.create({ overwrite: true });
  pending.write(JSON.stringify(artifacts));
  pending.moveSync(index, { overwrite: true });
}

export async function addArtifacts(selected: PickedArtifact[]): Promise<{ added: number; failed: number }> {
  if (!files.exists) files.create({ intermediates: true });
  const artifacts = await loadArtifacts();
  let added = 0;
  let failed = 0;

  for (const picked of selected) {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    const ext = picked.storedExtension || extension(picked.name);
    const localName = `${id}${ext ? `.${ext}` : ''}`;
    const destination = new File(files, localName);
    let appended = false;
    try {
      await new File(picked.uri).copy(destination);
      if (!destination.exists) throw new Error('The copied file could not be found.');
      artifacts.push({
        id,
        originalName: picked.name || `File${ext ? `.${ext}` : ''}`,
        localName,
        mimeType: picked.mimeType,
        type: artifactType(picked.name || localName, picked.mimeType),
        addedAt: new Date().toISOString(),
      });
      appended = true;
      // Commit each successful copy so a later failed selection cannot lose it.
      saveIndex(artifacts);
      added += 1;
    } catch {
      if (appended) artifacts.pop();
      if (destination.exists) destination.delete();
      failed += 1;
    }
  }
  return { added, failed };
}

export async function deleteArtifact(id: string): Promise<void> {
  const artifacts = await loadArtifacts();
  const artifact = artifacts.find((item) => item.id === id);
  if (!artifact) return;
  const storedFile = new File(files, artifact.localName);
  if (storedFile.exists) storedFile.delete();
  saveIndex(artifacts.filter((item) => item.id !== id));
}
