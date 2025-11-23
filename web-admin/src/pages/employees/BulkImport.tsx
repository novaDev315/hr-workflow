import React, { useState, useCallback } from 'react';
import { useMutation, gql } from '@apollo/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Upload, Download, FileSpreadsheet, CheckCircle, XCircle,
  AlertTriangle, Users, FileCheck, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

const IMPORT_EMPLOYEES = gql`
  mutation ImportEmployees($file: Upload!) {
    importEmployees(file: $file) {
      success
      failed
      createdEmployees
      errors {
        row
        field
        error
      }
    }
  }
`;

const EXPORT_EMPLOYEES = gql`
  mutation ExportEmployees($format: String!, $departmentId: ID, $status: String) {
    exportEmployees(format: $format, departmentId: $departmentId, status: $status)
  }
`;

export default function BulkImport() {
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [importEmployees, { loading: importing }] = useMutation(IMPORT_EMPLOYEES, {
    onCompleted: (data) => {
      setImportResult(data.importEmployees);
      if (data.importEmployees.success > 0) {
        toast.success(`Successfully imported ${data.importEmployees.success} employees`);
      }
      if (data.importEmployees.failed > 0) {
        toast.warning(`${data.importEmployees.failed} records failed to import`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.csv'))) {
      setFile(droppedFile);
      setImportResult(null);
    } else {
      toast.error('Please upload an Excel (.xlsx) or CSV file');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportResult(null);
    }
  };

  const handleImport = () => {
    if (!file) return;
    importEmployees({ variables: { file } });
  };

  const downloadTemplate = () => {
    // In real implementation, this would call the API
    toast.info('Downloading template...');
    // window.location.href = '/api/employees/import-template';
  };

  const exportEmployees = (format: 'xlsx' | 'csv') => {
    toast.info(`Exporting employees as ${format.toUpperCase()}...`);
    // Implementation would trigger download
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Bulk Import / Export</h1>
          <p className="text-gray-500">Import employees from Excel or CSV, or export employee data</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Import Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Bulk Import
            </CardTitle>
            <CardDescription>Upload an Excel or CSV file to import multiple employees</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Download Template */}
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-sm">Download Template</p>
                  <p className="text-xs text-gray-500">Get the correct format for importing</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" /> Template
              </Button>
            </div>

            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">
                Drag and drop your Excel or CSV file here
              </p>
              <p className="text-sm text-gray-400 mb-4">or</p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button variant="outline" type="button" asChild>
                  <span>Browse Files</span>
                </Button>
              </label>
            </div>

            {/* Selected File */}
            {file && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-1" /> Import
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Import Results */}
            {importResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
                    <p className="text-2xl font-bold text-green-700">{importResult.success}</p>
                    <p className="text-sm text-green-600">Successfully Imported</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg text-center">
                    <XCircle className="h-8 w-8 mx-auto text-red-600 mb-2" />
                    <p className="text-2xl font-bold text-red-700">{importResult.failed}</p>
                    <p className="text-sm text-red-600">Failed</p>
                  </div>
                </div>

                {importResult.createdEmployees?.length > 0 && (
                  <div>
                    <p className="font-medium text-sm mb-2">Created Employee Numbers:</p>
                    <div className="flex flex-wrap gap-2">
                      {importResult.createdEmployees.map((empNo: string) => (
                        <Badge key={empNo} variant="outline" className="bg-green-50">
                          {empNo}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {importResult.errors?.length > 0 && (
                  <div>
                    <p className="font-medium text-sm mb-2 text-red-600">Errors:</p>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {importResult.errors.map((error: any, idx: number) => (
                        <div key={idx} className="p-2 bg-red-50 rounded text-sm">
                          <span className="font-medium">Row {error.row}</span>
                          {error.field && <span className="text-gray-500"> - {error.field}</span>}
                          <span className="text-red-600">: {error.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" /> Bulk Export
            </CardTitle>
            <CardDescription>Export employee data to Excel or CSV format</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-3">Export All Employees</h3>
              <p className="text-sm text-gray-500 mb-4">
                Download complete employee data including personal info, department, designation, and salary details.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => exportEmployees('xlsx')} className="flex-1">
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Export Excel
                </Button>
                <Button variant="outline" onClick={() => exportEmployees('csv')} className="flex-1">
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Export CSV
                </Button>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-3">Export by Department</h3>
              <div className="space-y-3">
                <select className="w-full border rounded px-3 py-2">
                  <option value="">Select Department</option>
                  <option value="engineering">Engineering</option>
                  <option value="hr">Human Resources</option>
                  <option value="finance">Finance</option>
                  <option value="sales">Sales</option>
                </select>
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" /> Export Department
                </Button>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-3">Export by Status</h3>
              <div className="flex flex-wrap gap-2">
                {['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'RESIGNED'].map((status) => (
                  <Button
                    key={status}
                    variant="outline"
                    size="sm"
                    onClick={() => toast.info(`Exporting ${status} employees...`)}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-yellow-800">Data Privacy Notice</p>
                  <p className="text-xs text-yellow-700">
                    Exported data contains sensitive employee information. Handle with care and follow your organization's data privacy policies.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Import Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-medium mb-2">Required Fields</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• firstName (Employee first name)</li>
                <li>• lastName (Employee last name)</li>
                <li>• email (Unique email address)</li>
                <li>• department (Department name/code)</li>
                <li>• designation (Designation title/code)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">Optional Fields</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• phone (Phone number)</li>
                <li>• dateOfBirth (YYYY-MM-DD)</li>
                <li>• gender (MALE/FEMALE/OTHER)</li>
                <li>• employmentType (FULL_TIME/PART_TIME)</li>
                <li>• joinDate (YYYY-MM-DD)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">Tips</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Download template first</li>
                <li>• Ensure departments exist</li>
                <li>• Check for duplicate emails</li>
                <li>• Use correct date format</li>
                <li>• Max 500 rows per import</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
