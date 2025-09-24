import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, X, CheckCircle } from "lucide-react";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
}

export const UploadSection = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    const pdfFiles = droppedFiles.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== droppedFiles.length) {
      toast({
        title: "Attenzione",
        description: "Solo i file PDF sono supportati",
        variant: "destructive",
      });
    }
    
    pdfFiles.forEach(file => {
      const newFile: UploadedFile = {
        id: Date.now() + Math.random().toString(),
        name: file.name,
        size: file.size,
        status: 'uploading',
        progress: 0
      };
      
      setFiles(prev => [...prev, newFile]);
      
      // Simulate upload and processing
      simulateProcessing(newFile.id);
    });
  }, [toast]);

  const simulateProcessing = (fileId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      
      if (progress >= 100) {
        setFiles(prev => prev.map(file => 
          file.id === fileId 
            ? { ...file, status: 'completed', progress: 100 }
            : file
        ));
        clearInterval(interval);
        toast({
          title: "Elaborazione completata",
          description: "I lead sono stati estratti con successo",
        });
      } else {
        setFiles(prev => prev.map(file => 
          file.id === fileId 
            ? { 
                ...file, 
                progress,
                status: progress > 30 ? 'processing' : 'uploading'
              }
            : file
        ));
      }
    }, 500);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <section className="py-16 bg-gradient-subtle">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold mb-4">Carica i tuoi PDF</h3>
            <p className="text-muted-foreground text-lg">
              Trascina i file PDF dei bandi pubblici qui sotto o clicca per selezionarli
            </p>
          </div>

          <Card className="p-8 mb-8">
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
                isDragging 
                  ? 'border-primary bg-primary/5 scale-105' 
                  : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5'
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
            >
              <Upload className="h-16 w-16 text-primary mx-auto mb-4" />
              <h4 className="text-xl font-semibold mb-2">
                Trascina i PDF qui
              </h4>
              <p className="text-muted-foreground mb-6">
                o clicca per selezionare i file dal tuo computer
              </p>
              <Button variant="professional" size="lg">
                Seleziona file PDF
              </Button>
            </div>
          </Card>

          {files.length > 0 && (
            <Card className="p-6">
              <h4 className="text-lg font-semibold mb-4">File caricati ({files.length})</h4>
              <div className="space-y-4">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg">
                    <div className="p-2 bg-primary/10 rounded">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium truncate">{file.name}</p>
                        <div className="flex items-center gap-2">
                          {file.status === 'completed' && (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(file.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{formatFileSize(file.size)}</span>
                        <span className="capitalize">
                          {file.status === 'uploading' && 'Caricamento...'}
                          {file.status === 'processing' && 'Elaborazione...'}
                          {file.status === 'completed' && 'Completato'}
                          {file.status === 'error' && 'Errore'}
                        </span>
                      </div>
                      
                      {file.status !== 'completed' && (
                        <Progress value={file.progress} className="mt-2" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
};