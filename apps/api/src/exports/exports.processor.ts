
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JobStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service.js';
import ExcelJS from 'exceljs';

@Injectable()
export class ExportsProcessor {
  private readonly logger = new Logger(ExportsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async processJob(jobId: string): Promise<void> {
    
    const exportJob = await this.prisma.exportJob.findUnique({
      where: { id: jobId },
    });

    if (!exportJob) return;

    await this.prisma.exportJob.update({
      where: { id: jobId },
      data: { status: JobStatus.PROCESSING, startedAt: new Date() },
    });

    try {
      this.logger.log(`Processing job ${exportJob.id} (${exportJob.jobType})`);

      const workbook = new ExcelJS.Workbook();

      if (exportJob.jobType === 'PROJECT_EXPORT') {
        const projectId = (exportJob.parameters as any)?.projectId;
        if (!projectId) throw new Error('projectId missing from parameters');
        
        // --- Sheet 1: Literature Review ---
        const worksheet = workbook.addWorksheet('Literature Review');
        
        const columns = [
          { header: 'Assigned Network Name', key: 'assigned_name', width: 25 },
          { header: 'Paper Title', key: 'title', width: 40 },
          { header: 'Authors', key: 'authors', width: 30 },
          { header: 'Publication Year', key: 'year', width: 15 },
          { header: 'Paper Type', key: 'paper_type', width: 18 },
          { header: 'Journal / Conference', key: 'journal', width: 25 },
          { header: 'Publisher', key: 'publisher', width: 20 },
          { header: 'Paper Link', key: 'link', width: 30 },
          { header: 'PDF Link', key: 'pdf_link', width: 30 },
          { header: 'DOI', key: 'doi', width: 25 },
          { header: 'Research Area', key: 'research_area', width: 20 },
          { header: 'Keywords', key: 'keywords', width: 25 },
          { header: 'Methodology', key: 'methodology', width: 20 },
          { header: 'Dataset / Sample', key: 'dataset', width: 25 },
          { header: 'Abstract', key: 'abstract', width: 50 },
          { header: 'Volume', key: 'volume', width: 10 },
          { header: 'Issue', key: 'issue', width: 10 },
          { header: 'Pages', key: 'pages', width: 12 },
          { header: 'Accessibility', key: 'accessibility', width: 14 },
          { header: 'Priority', key: 'priority', width: 12 },
          { header: 'Status', key: 'status', width: 14 },
          { header: 'Progress %', key: 'progress', width: 12 },
          { header: 'Notes', key: 'notes', width: 30 },
          { header: 'Q1. Problem & Importance', key: 'q1', width: 40 },
          { header: 'Q2. Data Used', key: 'q2', width: 40 },
          { header: 'Q3. Features / Inputs', key: 'q3', width: 40 },
          { header: 'Q4. Methods / Pipeline', key: 'q4', width: 40 },
          { header: 'Q5. Baselines', key: 'q5', width: 40 },
          { header: 'Q6. Evaluation', key: 'q6', width: 40 },
          { header: 'Q7. Key Results', key: 'q7', width: 40 },
          { header: 'Q8. Limitations & Biases', key: 'q8', width: 40 },
          { header: 'Q9. Replication Artifacts', key: 'q9', width: 40 },
        ];
        
        worksheet.columns = columns;

        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, size: 11 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };

        // Fetch assignments to get readers and papers
        const assignments = await this.prisma.paperAssignment.findMany({
          where: { projectId, assignmentType: 'PRIMARY_READER' },
          include: {
            user: true,
            paper: { include: { researchArea: { select: { name: true } } } },
          }
        });

        for (const assignment of assignments) {
          const paper = assignment.paper;
          const meta = (paper.metadata as Record<string, any>) || {};
          const authorsArr = Array.isArray(paper.authors) ? paper.authors : [];
          const keywordsArr = Array.isArray(meta.keywords) ? meta.keywords : [];

          const rowData: any = {
            assigned_name: assignment.user.fullName,
            title: paper.title,
            authors: authorsArr.join(', '),
            year: paper.publicationYear || '',
            paper_type: meta.paperType || '',
            journal: paper.journalName || '',
            publisher: paper.publisher || '',
            link: paper.canonicalUrl || '',
            pdf_link: paper.pdfUrl || '',
            doi: paper.doi || '',
            research_area: paper.researchArea?.name || meta.researchArea || '',
            keywords: keywordsArr.join(', '),
            methodology: meta.methodology || '',
            dataset: meta.dataset || '',
            abstract: paper.abstract || '',
            volume: meta.volume || '',
            issue: meta.issue || '',
            pages: meta.pages || '',
            accessibility: meta.accessibility || '',
            priority: meta.priority || '',
            status: assignment.status,
            progress: Number(assignment.progressPercent),
            notes: meta.notes || '',
            q1: meta.q1 || '',
            q2: meta.q2 || '',
            q3: meta.q3 || '',
            q4: meta.q4 || '',
            q5: meta.q5 || '',
            q6: meta.q6 || '',
            q7: meta.q7 || '',
            q8: meta.q8 || '',
            q9: meta.q9 || '',
          };
          
          // Override with ResearchResponse data if available (from Literature Tracker)
          const responses = await this.prisma.researchResponse.findMany({
            where: { projectId, paperId: assignment.paperId, userId: assignment.userId },
            include: { question: true },
            orderBy: { question: { displayOrder: 'asc' } },
          });
          
          let qIndex = 1;
          for (const resp of responses) {
            let val = resp.answerText || resp.answerNumber?.toString() || (resp.answerBoolean !== null ? resp.answerBoolean.toString() : '');
            if (resp.answerDate) val = resp.answerDate.toISOString().split('T')[0];
            if (resp.answerJson) val = JSON.stringify(resp.answerJson);
            
            const key = resp.question.excelColumn ? resp.question.excelColumn.toLowerCase() : `q${qIndex}`;
            if (val && columns.some(c => c.key === key)) {
              rowData[key] = val;
            }
            qIndex++;
          }
          
          worksheet.addRow(rowData);
        }

        // --- Sheet 2: Guidelines (Thinks to consider & Answers to look for) ---
        const guideSheet = workbook.addWorksheet('Guidelines');
        
        guideSheet.addRow(['Thinks to consider while writing summary of a paper']);
        guideSheet.addRow(['Type of work: empirical study, methodological paper, system, survey, theory.']);
        guideSheet.addRow(['Problem addressed: what issue or gap the paper targets and why it matters.']);
        guideSheet.addRow(['Data used: source, size, time frame, population, licensing, train/val/test split.']);
        guideSheet.addRow(['Methodology: models, algorithms, toolkits, baselines, experimental setup.']);
        guideSheet.addRow(['Pipeline: preprocessing, feature engineering, training, validation procedure.']);
        guideSheet.addRow(['Results: key metrics with numbers and tables or figures referenced.']);
        guideSheet.addRow(['New findings or comparisons: novelty, ablations, comparison to prior work or SOTA.']);
        guideSheet.addRow(['Limitations: threats to validity, assumptions, generalizability.']);
        
        guideSheet.addRow([]);
        
        guideSheet.addRow(['Answers to look for during paper reading']);
        guideSheet.addRow(['Q1. What problem do the authors address and why is it important?']);
        guideSheet.addRow(['Q2. What data is used (source, size, timeframe, splits, collection process, ethics or consent)?']);
        guideSheet.addRow(['Q3. What features or inputs are used, and how were they selected or engineered?']);
        guideSheet.addRow(['Q4. What methods or models are applied, and what is the overall pipeline?']);
        guideSheet.addRow(['Q5. What baselines are used for comparison, and why were they chosen?']);
        guideSheet.addRow(['Q6. How is performance evaluated (metrics, experimental setup, statistical tests, user studies if applicable)?']);
        guideSheet.addRow(['Q7. What are the key results with numbers, and how do they compare to baselines or prior work?']);
        guideSheet.addRow(['Q8. What are the limitations and potential biases?']);
        guideSheet.addRow(['Q9. Is code, data, or other artifacts available to enable replication?']);
        
        guideSheet.getColumn(1).width = 100;
        
      } else {
        const worksheet = workbook.addWorksheet('Export');
        worksheet.columns = [{ header: 'Data', key: 'data' }];
        worksheet.addRow({ data: 'Generic Export Data' });
      }

      // Buffer to base64 for download
      const buffer = await workbook.xlsx.writeBuffer();
      const base64Data = Buffer.from(buffer).toString('base64');
      const fileUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64Data}`;

      await this.prisma.exportJob.update({
        where: { id: exportJob.id },
        data: { 
          status: JobStatus.COMPLETED, 
          completedAt: new Date(),
          fileUrl 
        },
      });

      await this.notifications.create({
        organizationId: exportJob.organizationId,
        userId: exportJob.requestedBy,
        title: 'Export Completed',
        content: `Your requested export (${exportJob.jobType}) is ready to download.`,
        type: 'SYSTEM',
        referenceId: exportJob.id,
        referenceType: 'EXPORT_JOB',
      });
    } catch (error) {
      this.logger.error(`Failed to process job ${exportJob.id}`, error);
      await this.prisma.exportJob.update({
        where: { id: exportJob.id },
        data: { 
          status: JobStatus.FAILED, 
          errorMessage: error instanceof Error ? error.message : String(error)
        },
      });
    }
  }
}
