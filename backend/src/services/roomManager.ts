/**
 * Room 管理器
 * 用於管理 WebSocket 連線的房間（群組）
 */
class RoomManager {
	/** roomName -> Set of connectionIds */
	private rooms: Map<string, Set<string>> = new Map();
	/** connectionId -> Set of roomNames */
	private connectionRooms: Map<string, Set<string>> = new Map();

	/**
	 * 加入房間
	 */
	join(connectionId: string, roomName: string): void {
		if (!this.rooms.has(roomName)) {
			this.rooms.set(roomName, new Set());
		}
		this.rooms.get(roomName)!.add(connectionId);

		if (!this.connectionRooms.has(connectionId)) {
			this.connectionRooms.set(connectionId, new Set());
		}
		this.connectionRooms.get(connectionId)!.add(roomName);
	}

	/**
	 * 離開房間
	 */
	leave(connectionId: string, roomName: string): void {
		const room = this.rooms.get(roomName);
		if (room) {
			room.delete(connectionId);
			if (room.size === 0) {
				this.rooms.delete(roomName);
			}
		}

		const rooms = this.connectionRooms.get(connectionId);
		if (rooms) {
			rooms.delete(roomName);
			if (rooms.size === 0) {
				this.connectionRooms.delete(connectionId);
			}
		}
	}

	/**
	 * 離開所有房間
	 */
	leaveAll(connectionId: string): void {
		const rooms = this.connectionRooms.get(connectionId);
		if (rooms) {
			// 複製一份房間列表，避免在迭代時修改
			const roomsCopy = Array.from(rooms);
			for (const roomName of roomsCopy) {
				this.leave(connectionId, roomName);
			}
		}
	}

	/**
	 * 取得房間成員
	 */
	getMembers(roomName: string): string[] {
		const room = this.rooms.get(roomName);
		return room ? Array.from(room) : [];
	}
}

export const roomManager = new RoomManager();
