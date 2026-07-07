/** Domain types for experiments (mirror the backend Pydantic schemas). */

export interface Experiment {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface NewExperiment {
  name: string;
  description?: string;
}
