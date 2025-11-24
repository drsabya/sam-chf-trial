export type VisitType = {
	id: string;
	participantId: string;
	visitNumber: number;
	startDate: string;
	dueDate: string;
	scheduledOn: string | null; // 👉 default null when not scheduled
	completedOn: string | null; // 👉 default null when visit not completed
	voucherGiven: boolean | true; // default true

	// IMPORTANT DOCUMENTS
	safetySrc?: string | null;
	efficacySrc?: string | null;
	prescriptionSrc?: string | null;
	signatureSrc?: string | null;
	echoSrc?: string | null;
	ecgSrc?: string | null;
	uptSrc?: string | null;
};

// Visit 1 – ONLY fields actually present in the CRF for Visit 1
export type Visit1Type = VisitType & {
	// PHYSICAL ASSESSMENT (page 6)
	height?: number | null; // cm
	weight?: number | null; // kg
	bmi?: number | null; // kg/m²
	history?: string | null;

	// GENERAL EXAMINATION (page 6)
	temperature?: number | null; // °C
	pulseRate?: number | null; // beats/min
	sbp?: number | null; // mmHg
	dbp?: number | null; // mmHg
	respiratoryRate?: number | null; // breaths/min

	// SYSTEMIC EXAMINATION (page 6)
	cvs?: string | null;
	cns?: string | null;
	rs?: string | null;
	pa?: string | null;

	// CONCOMITANT INFO (page 7)
	concomitantMedications?: string | null; // meds other than study drugs being taken
	concomitantIllness?: string | null; // other illnesses apart from HF
	// (Compliance by self-reporting is NA at Visit 1 in CRF → omitted)

	// BLOOD INVESTIGATIONS (Visit 1 column, page 7)
	hb?: number | null; // g/dL
	rbc?: number | null; // million/cmm
	wbc?: number | null; // /µL
	polymorphs?: number | null; // % of neutrophils
	lymphocytes?: number | null; // %
	monocytes?: number | null; // %
	platelets?: number | null; // x10^3 /cmm

	sgot?: number | null; // U/L (AST)
	sgpt?: number | null; // U/L (ALT)
	directBilirubin?: number | null; // mg/dL
	indirectBilirubin?: number | null; // mg/dL
	bun?: number | null; // mg/dL
	creatinine?: number | null; // mg/dL

	totalCholesterol?: number | null; // mg/dL
	hdl?: number | null; // mg/dL
	ldl?: number | null; // mg/dL
	triglycerides?: number | null; // mg/dL

	// SPECIFIC BIOCHEMICAL MARKERS (Visit 1 column, page 8)
	ntProBnp?: number | null; // pg/mL
	serumTsh?: number | null; // mIU/L
	serumHomocysteine?: number | null; // µmol/L

	// CARDIAC INVESTIGATIONS (Visit 1 column, page 9)
	ecgReport?: string | null; // ECG interpretation
	lvef?: number | null; // % from 2D Echo

	// PREGNANCY TEST (Visit 1, page 10)
	uptResult?: 'positive' | 'negative' | 'not_applicable' | null;
};
