export type ParticipantType = {
	id: string;
	firstName: string;
	middleName?: string;
	lastName: string;
	phone: string; // primary contact number
	alternatePhone?: string;
	initials: string; // derived from first, middle, last name
	age: number;
	sex: string;
	address: string;
	education: string;
	occupation: string;
	income: number;
	createdAt: string;
	createdBy?: string | null; // default is null
	signatureSrc?: string; // optional for consent form

	// IDs
	screeningId: string; // "S1", "S2", "S3", ...
	screeningFailure?: boolean; // default false
	randomizationId: string | null; // "R1", "R2", "R3", ... or null until randomised
	randomizationCode?: string | null; // "A" or "B", default null
};
