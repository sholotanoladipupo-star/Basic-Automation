import React, { useRef } from 'react';
import { CVData, Template } from '../types';
import { Download, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ModernTemplate from './templates/ModernTemplate';
import ProfessionalTemplate from './templates/ProfessionalTemplate';
import CreativeTemplate from './templates/CreativeTemplate';
import MinimalTemplate from './templates/MinimalTemplate';

interface CVPreviewProps {
  cvData: CVData;
  template: Template;
}

export default function CVPreview({ cvData, template }: CVPreviewProps) {
  const cvRef = useRef<HTMLDivElement>(null);

  const renderTemplate = () => {
    switch (template) {
      case 'modern':
        return <ModernTemplate cvData={cvData} />;
      case 'professional':
        return <ProfessionalTemplate cvData={cvData} />;
      case 'creative':
        return <CreativeTemplate cvData={cvData} />;
      case 'minimal':
        return <MinimalTemplate cvData={cvData} />;
      default:
        return <ModernTemplate cvData={cvData} />;
    }
  };

  const handleDownloadPDF = async () => {
    if (!cvRef.current) return;

    try {
      const canvas = await html2canvas(cvRef.current, {
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= 297;
      }

      pdf.save(`${cvData.personalInfo.fullName || 'CV'}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex gap-4 justify-center sticky top-20 z-40">
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-lg"
        >
          <Download className="w-5 h-5" />
          Download as PDF
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition shadow-lg"
        >
          <Printer className="w-5 h-5" />
          Print
        </button>
      </div>

      {/* CV Preview */}
      <div className="bg-white rounded-lg shadow-lg p-8 print:shadow-none print:rounded-none print:p-0">
        <div ref={cvRef} className="print:p-0">
          {renderTemplate()}
        </div>
      </div>
    </div>
  );
}
