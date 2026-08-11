const WEB_OBJECT_STORE = 'evidence';

export function runEvidenceTransaction<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(WEB_OBJECT_STORE, mode);
    let request: IDBRequest<T>;
    let result: T;
    let operationError: Error | DOMException | null = null;
    try {
      request = createRequest(transaction.objectStore(WEB_OBJECT_STORE));
    } catch (error) {
      transaction.abort();
      reject(error);
      return;
    }
    request.onerror = () => {
      operationError = request.error ?? new Error('Private evidence storage operation failed.');
    };
    request.onsuccess = () => {
      result = request.result;
    };
    transaction.onabort = () => reject(operationError ?? transaction.error ?? new Error('Private evidence storage transaction was aborted.'));
    transaction.onerror = () => {
      operationError = operationError ?? transaction.error ?? new Error('Private evidence storage transaction failed.');
    };
    transaction.oncomplete = () => {
      if (operationError) reject(operationError);
      else resolve(result!);
    };
  });
}
