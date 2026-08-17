export interface LocalFileSnapshot {
  key: string;
  projectId: string;
  filePath: string;
  content: string;
  savedAt: number;
}

const DB_NAME = "synthex-editor";
const STORE_NAME = "file-snapshots";

function keyFor(projectId: string, filePath: string) {
  return `${projectId}:${filePath}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

export function saveLocalSnapshot(
  projectId: string,
  filePath: string,
  content: string,
) {
  return run("readwrite", (store) =>
    store.put({
      key: keyFor(projectId, filePath),
      projectId,
      filePath,
      content,
      savedAt: Date.now(),
    }),
  );
}

export function getLocalSnapshot(projectId: string, filePath: string) {
  return run<LocalFileSnapshot | undefined>("readonly", (store) =>
    store.get(keyFor(projectId, filePath)),
  );
}

export function removeLocalSnapshot(projectId: string, filePath: string) {
  return run("readwrite", (store) => store.delete(keyFor(projectId, filePath)));
}
