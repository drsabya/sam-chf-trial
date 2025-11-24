export type UserType = {
	id: string;
	email: string;
	role: 'admin' | 'coordinator' | 'data_entry' | 'viewer' | 'lab_admin' | 'pi';
	createdAt: string;
	updatedAt: string;
};
