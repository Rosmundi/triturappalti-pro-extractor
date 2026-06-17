import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProcessedTenders from "./pages/ProcessedTenders";
import NotFound from "./pages/NotFound";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import UploadPage from "./pages/UploadPage";
import LeadsAll from "./pages/LeadsAll";
import Exports from "./pages/Exports";
import Settings from "./pages/Settings";
import { ThemeProvider } from "./components/ThemeProvider";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/carica" element={<UploadPage />} />
              <Route path="/appalti-elaborati" element={<ProcessedTenders />} />
              <Route path="/lead" element={<LeadsAll />} />
              <Route path="/esportazioni" element={<Exports />} />
              <Route path="/impostazioni" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
