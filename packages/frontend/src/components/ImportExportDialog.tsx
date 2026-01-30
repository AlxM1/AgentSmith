/**
 * Import/Export Dialog Component
 *
 * Modal for importing and exporting workflows:
 * - Export single or multiple workflows
 * - Import from JSON files
 * - Options for credentials and settings
 * - Progress tracking for bulk operations
 */

import { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ImportExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'import' | 'export';
  selectedWorkflows?: string[];
}

interface ImportResult {
  success: boolean;
  workflowId?: string;
  workflowName?: string;
  errors?: string[];
  warnings?: string[];
}

interface ExportOptions {
  includeCredentials: boolean;
  includeHistory: boolean;
  format: 'json' | 'yaml';
}

interface ImportOptions {
  overwrite: boolean;
  importCredentials: boolean;
  namePrefix: string;
  nameSuffix: string;
}

export function ImportExportDialog({
  isOpen,
  onClose,
  mode,
  selectedWorkflows = [],
}: ImportExportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export state
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeCredentials: false,
    includeHistory: false,
    format: 'json',
  });

  // Import state
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    overwrite: false,
    importCredentials: false,
    namePrefix: '',
    nameSuffix: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<any>(null);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Export mutation
  const exportWorkflows = useMutation({
    mutationFn: async () => {
      if (selectedWorkflows.length === 1) {
        // Single workflow export
        const res = await fetch(`/api/v1/import-export/export/${selectedWorkflows[0]}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(exportOptions),
        });
        if (!res.ok) throw new Error('Export failed');
        return res.blob();
      } else {
        // Bulk export
        const res = await fetch('/api/v1/import-export/bulk-export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflowIds: selectedWorkflows,
            ...exportOptions,
          }),
        });
        if (!res.ok) throw new Error('Export failed');
        return res.blob();
      }
    },
    onSuccess: (blob) => {
      // Download file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflows_export_${Date.now()}.${exportOptions.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    },
  });

  // Import mutation
  const importWorkflows = useMutation({
    mutationFn: async () => {
      if (!fileContent) throw new Error('No file selected');

      // Check if bulk import
      if (fileContent.workflows && Array.isArray(fileContent.workflows)) {
        const res = await fetch('/api/v1/import-export/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: fileContent,
            ...importOptions,
          }),
        });
        if (!res.ok) throw new Error('Import failed');
        return res.json();
      } else {
        // Single workflow import
        const res = await fetch('/api/v1/import-export/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: fileContent,
            ...importOptions,
          }),
        });
        if (!res.ok) throw new Error('Import failed');
        return res.json();
      }
    },
    onSuccess: (data) => {
      if (data.results) {
        setImportResults(data.results);
      } else {
        setImportResults([data]);
      }
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        setFileContent(content);
      } catch {
        alert('Invalid JSON file');
        setSelectedFile(null);
        setFileContent(null);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  const resetImport = () => {
    setSelectedFile(null);
    setFileContent(null);
    setImportResults([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {mode === 'export' ? 'Export Workflows' : 'Import Workflows'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {mode === 'export' ? (
            <div className="space-y-4">
              {/* Selected Workflows */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Workflows to Export
                </label>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedWorkflows.length === 0
                      ? 'No workflows selected'
                      : `${selectedWorkflows.length} workflow(s) selected`}
                  </p>
                </div>
              </div>

              {/* Export Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Options
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeCredentials}
                      onChange={(e) =>
                        setExportOptions((prev) => ({
                          ...prev,
                          includeCredentials: e.target.checked,
                        }))
                      }
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Include credentials (encrypted)
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeHistory}
                      onChange={(e) =>
                        setExportOptions((prev) => ({
                          ...prev,
                          includeHistory: e.target.checked,
                        }))
                      }
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Include version history
                    </span>
                  </label>
                </div>
              </div>

              {/* Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Format
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="format"
                      value="json"
                      checked={exportOptions.format === 'json'}
                      onChange={() =>
                        setExportOptions((prev) => ({ ...prev, format: 'json' }))
                      }
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">JSON</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="format"
                      value="yaml"
                      checked={exportOptions.format === 'yaml'}
                      onChange={() =>
                        setExportOptions((prev) => ({ ...prev, format: 'yaml' }))
                      }
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">YAML</span>
                  </label>
                </div>
              </div>

              {exportOptions.includeCredentials && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Warning:</strong> Exported credentials will be encrypted but
                    should still be handled securely.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {importResults.length > 0 ? (
                /* Import Results */
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    Import Results
                  </h4>
                  <div className="space-y-2">
                    {importResults.map((result, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg ${
                          result.success
                            ? 'bg-green-50 dark:bg-green-900/20'
                            : 'bg-red-50 dark:bg-red-900/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-medium ${
                              result.success
                                ? 'text-green-800 dark:text-green-200'
                                : 'text-red-800 dark:text-red-200'
                            }`}
                          >
                            {result.workflowName || 'Workflow'}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              result.success
                                ? 'bg-green-200 text-green-800'
                                : 'bg-red-200 text-red-800'
                            }`}
                          >
                            {result.success ? 'Success' : 'Failed'}
                          </span>
                        </div>
                        {result.errors && result.errors.length > 0 && (
                          <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
                            {result.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        )}
                        {result.warnings && result.warnings.length > 0 && (
                          <ul className="mt-2 text-sm text-yellow-600 list-disc list-inside">
                            {result.warnings.map((warn, i) => (
                              <li key={i}>{warn}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={resetImport}
                    className="mt-4 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Import another file
                  </button>
                </div>
              ) : (
                <>
                  {/* File Drop Zone */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    {selectedFile ? (
                      <div>
                        <p className="text-gray-900 dark:text-white font-medium">
                          {selectedFile.name}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                        {fileContent && (
                          <p className="text-sm text-green-600 mt-2">
                            {fileContent.workflows
                              ? `${fileContent.workflows.length} workflow(s) found`
                              : fileContent.workflow
                              ? '1 workflow found'
                              : 'Valid file'}
                          </p>
                        )}
                        <button
                          onClick={resetImport}
                          className="mt-2 text-sm text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div>
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                          Drag and drop a JSON file here, or
                        </p>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="mt-2 text-blue-600 hover:text-blue-700"
                        >
                          browse files
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".json"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleFileSelect(e.target.files[0]);
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Import Options */}
                  {fileContent && (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Options
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={importOptions.overwrite}
                          onChange={(e) =>
                            setImportOptions((prev) => ({
                              ...prev,
                              overwrite: e.target.checked,
                            }))
                          }
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Overwrite existing workflows with same name
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={importOptions.importCredentials}
                          onChange={(e) =>
                            setImportOptions((prev) => ({
                              ...prev,
                              importCredentials: e.target.checked,
                            }))
                          }
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Import credentials (if included)
                        </span>
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Name Prefix
                          </label>
                          <input
                            type="text"
                            value={importOptions.namePrefix}
                            onChange={(e) =>
                              setImportOptions((prev) => ({
                                ...prev,
                                namePrefix: e.target.value,
                              }))
                            }
                            placeholder="e.g., [Imported] "
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Name Suffix
                          </label>
                          <input
                            type="text"
                            value={importOptions.nameSuffix}
                            onChange={(e) =>
                              setImportOptions((prev) => ({
                                ...prev,
                                nameSuffix: e.target.value,
                              }))
                            }
                            placeholder="e.g., (copy)"
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {importResults.length > 0 ? 'Close' : 'Cancel'}
          </button>
          {importResults.length === 0 && (
            <button
              onClick={() => {
                if (mode === 'export') {
                  exportWorkflows.mutate();
                } else {
                  importWorkflows.mutate();
                }
              }}
              disabled={
                mode === 'export'
                  ? selectedWorkflows.length === 0 || exportWorkflows.isPending
                  : !fileContent || importWorkflows.isPending
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mode === 'export'
                ? exportWorkflows.isPending
                  ? 'Exporting...'
                  : 'Export'
                : importWorkflows.isPending
                ? 'Importing...'
                : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportExportDialog;
