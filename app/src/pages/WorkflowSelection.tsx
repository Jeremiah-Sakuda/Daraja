import { useNavigate } from 'react-router-dom';
import { ClipboardList, Stethoscope, Scale, Clock, FileText, ChevronRight } from 'lucide-react';
import { WORKFLOWS, type WorkflowType } from '../types/workflow';

interface WorkflowCardProps {
  type: WorkflowType;
  icon: React.ReactNode;
  estimatedTime: string;
  questionCount: number;
  onSelect: () => void;
}

function WorkflowCard({ type, icon, estimatedTime, questionCount, onSelect }: WorkflowCardProps) {
  const workflow = WORKFLOWS[type];

  return (
    <button
      onClick={onSelect}
      className="card-interactive w-full text-left"
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-daraja-100 flex items-center justify-center text-daraja-600">
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-daraja-900 mb-1">
            {workflow.title}
          </h3>
          <p className="text-sm text-daraja-600 mb-3">
            {workflow.description}
          </p>

          <div className="flex items-center gap-4 text-xs text-daraja-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {estimatedTime}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              {questionCount} questions
            </span>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-daraja-400 flex-shrink-0 self-center" />
      </div>
    </button>
  );
}

export function WorkflowSelection() {
  const navigate = useNavigate();

  const handleSelectWorkflow = (type: WorkflowType) => {
    navigate(`/interview/${type}`);
  };

  // Calculate question counts
  const rsdQuestionCount = WORKFLOWS.rsd_interview.sections.reduce(
    (sum, s) => sum + s.fields.length, 0
  );
  const medicalQuestionCount = WORKFLOWS.medical_intake.sections.reduce(
    (sum, s) => sum + s.fields.length, 0
  );
  const legalQuestionCount = WORKFLOWS.legal_declaration.sections.reduce(
    (sum, s) => sum + s.fields.length, 0
  );

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6">
      <div>
        <h1 className="section-header">Select Workflow</h1>
        <p className="text-sm text-daraja-500">
          Choose the type of interview to conduct
        </p>
      </div>

      <div className="space-y-4">
        <WorkflowCard
          type="rsd_interview"
          icon={<ClipboardList className="w-6 h-6" />}
          estimatedTime="30-45 min"
          questionCount={rsdQuestionCount}
          onSelect={() => handleSelectWorkflow('rsd_interview')}
        />

        <WorkflowCard
          type="medical_intake"
          icon={<Stethoscope className="w-6 h-6" />}
          estimatedTime="15-20 min"
          questionCount={medicalQuestionCount}
          onSelect={() => handleSelectWorkflow('medical_intake')}
        />

        <WorkflowCard
          type="legal_declaration"
          icon={<Scale className="w-6 h-6" />}
          estimatedTime="20-30 min"
          questionCount={legalQuestionCount}
          onSelect={() => handleSelectWorkflow('legal_declaration')}
        />
      </div>

      <div className="flex-1" />

      <p className="text-xs text-daraja-400 text-center">
        All workflows support voice input and offline operation
      </p>
    </div>
  );
}
