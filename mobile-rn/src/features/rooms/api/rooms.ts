import { apiClient } from '../../../lib/api-client';
import { roomFromApi, type Room } from '../../../types/api';

/** Oda yönetimi (admin) — /rooms. */

export async function getRooms(): Promise<Room[]> {
  const { data } = await apiClient.get('/rooms');
  return (Array.isArray(data) ? data : []).map(roomFromApi);
}

export async function createRoom(name: string, devices: number): Promise<Room> {
  const { data } = await apiClient.post('/rooms', { name, devices });
  return roomFromApi(data);
}

export async function updateRoom(id: number, name: string, devices: number): Promise<Room> {
  const { data } = await apiClient.put(`/rooms/${id}`, { name, devices });
  return roomFromApi(data);
}

export async function deleteRoom(id: number): Promise<void> {
  await apiClient.delete(`/rooms/${id}`);
}
