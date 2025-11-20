import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, X, CheckCircle, Play, Loader2 } from "lucide-react";
import { WEBHOOKS } from "@/config/webhooks";

interface Lead {
  id: string;
  cigAppalto: string;
  descrizioneAppalto: string;
  leadName: string;
  leadEmail: string;
  leadNumber: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
  progress: number;
  file: File; // Store the actual file object
}

interface UploadSectionProps {
  onLeadsExtracted: (leads: Lead[]) => void;
}

export const UploadSection = ({ onLeadsExtracted }: UploadSectionProps) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback((selectedFiles: File[]) => {
    const pdfFiles = selectedFiles.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length !== selectedFiles.length) {
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
        status: 'uploaded',
        progress: 0,
        file: file // Store the actual file
      };
      
      setFiles(prev => [...prev, newFile]);
    });

    if (pdfFiles.length > 0) {
      toast({
        title: "File caricati",
        description: `${pdfFiles.length} PDF pronti per l'elaborazione`,
      });
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  }, [processFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    processFiles(Array.from(e.target.files));
    e.target.value = "";
  }, [processFiles]);

  const startProcessing = async () => {
    const uploadedFiles = files.filter(file => file.status === 'uploaded');
    
    if (uploadedFiles.length === 0) {
      toast({
        title: "Nessun file da elaborare",
        description: "Carica almeno un PDF prima di avviare l'elaborazione",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    toast({
      title: "Elaborazione avviata",
      description: `Invio di ${uploadedFiles.length} PDF a n8n per elaborazione...`,
    });

    // Process each file
    for (const file of uploadedFiles) {
      await sendToN8n(file.id);
    }
    
    setIsProcessing(false);
    
    toast({
      title: "File inviati a n8n",
      description: "I PDF sono stati inviati. Attendi il ritorno dei contatti elaborati.",
    });
  };

  const sendToN8n = async (fileId: string): Promise<void> => {
    const uploadedFile = files.find(f => f.id === fileId);
    if (!uploadedFile) return;

    setFiles(prev => prev.map(f => 
      f.id === fileId 
        ? { ...f, status: 'processing', progress: 0 }
        : f
    ));

    try {
      console.log(`Invio file ${uploadedFile.name} a n8n webhook`);
      
      const formData = new FormData();
      formData.append('file', uploadedFile.file);
      formData.append('filename', uploadedFile.name);
      
      const response = await fetch(WEBHOOKS.INVIO_PDF, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Risposta da n8n:', result);

      setFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, status: 'completed', progress: 100 }
          : f
      ));

      // Transform n8n response to Lead object
      if (result) {
        const lead: Lead = {
          id: Date.now().toString() + Math.random(),
          cigAppalto: result.cig || '',
          descrizioneAppalto: result.title || '',
          leadName: result.company || result.full_name || '',
          leadEmail: result.email || result.phone_e164 || '',
          leadNumber: result.phone_e164 || result.website || ''
        };
        onLeadsExtracted([lead]);
      }

    } catch (error) {
      console.error('Errore invio a n8n:', error);
      setFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, status: 'error', progress: 0 }
          : f
      ));
      
      toast({
        title: "Errore",
        description: "Impossibile inviare il file a n8n. Riprova.",
        variant: "destructive",
      });
    }
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
    <section className="py-16 bg-gradient-subtle" data-section="upload">
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
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
                aria-label="Seleziona file PDF"
              />
              <Button variant="professional" size="lg" onClick={() => inputRef.current?.click()}>
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
                          {file.status === 'uploaded' && 'Pronto'}
                          {file.status === 'processing' && 'Elaborazione...'}
                          {file.status === 'completed' && 'Completato'}
                          {file.status === 'error' && 'Errore'}
                        </span>
                      </div>
                      
                      {file.status !== 'completed' && file.status !== 'uploaded' && (
                        <Progress value={file.progress} className="mt-2" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {files.some(file => file.status === 'uploaded') && (
                <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-semibold mb-1">
                        Pronti per l'elaborazione
                      </h5>
                      <p className="text-sm text-muted-foreground">
                        {files.filter(f => f.status === 'uploaded').length} file PDF caricati
                      </p>
                    </div>
                    <Button 
                      variant="hero" 
                      size="lg"
                      onClick={startProcessing}
                      disabled={isProcessing}
                      className="min-w-[160px]"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Elaborando...
                        </>
                      ) : (
                        <>
                          <Play className="h-5 w-5" />
                          Avvia elaborazione
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </section>
  );
};