import { apiClient } from '../../../lib/api-client';

/** Seans puanı raporları — backend /api/ratings şekline birebir. */

export interface RatingBucket {
  /** Değerlendirme sayısı — ortalamayı bu oluşturur */
  count: number;
  /** Puan veren farklı üye sayısı; aynı üye birden çok seansını puanlayabilir */
  raters: number;
  eligible: number;
  lowCount: number;
  /** n < minSample ise null — az örneklemli ortalama gösterilmez */
  avg: number | null;
  rawAvg: number | null;
  bayesAvg: number | null;
  responseRate: number | null;
}

export interface StaffRatingRow {
  staffId: number | null;
  staffName: string;
  isFormer: boolean;
  months: RatingBucket[];
  total: RatingBucket;
}

export interface StaffRatingSummary {
  year: number;
  globalMean: number | null;
  globalCount: number;
  minSample: number;
  bayesWeight: number;
  staff: StaffRatingRow[];
  monthTotals: RatingBucket[];
  grand: RatingBucket;
}

export interface RatingListItem {
  sessionId: number;
  rating: number;
  comment: string;
  memberName: string;
  sessionStartTs: number;
  createdAt: string;
}

export interface RatingList {
  staffId: number;
  year: number;
  month: number | null;
  distribution: Record<string, number>;
  items: RatingListItem[];
}

export interface MyRatingSummary {
  year: number;
  staffId: number;
  minSample: number;
  months: RatingBucket[];
  total: RatingBucket;
}

export async function getStaffRatingSummary(year: number): Promise<StaffRatingSummary> {
  const { data } = await apiClient.get<StaffRatingSummary>('/ratings/staff-summary', {
    params: { year },
  });
  return data;
}

export async function getRatingList(
  staffId: number,
  year: number,
  month?: number
): Promise<RatingList> {
  const { data } = await apiClient.get<RatingList>('/ratings/list', {
    params: { staffId, year, month },
  });
  return data;
}

export async function getMyRatingSummary(): Promise<MyRatingSummary> {
  const { data } = await apiClient.get<MyRatingSummary>('/ratings/my-summary');
  return data;
}
