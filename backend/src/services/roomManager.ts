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
		// 將連線加入房間
		if (!this.rooms.has(roomName)) {
			this.rooms.set(roomName, new Set());
		}
		this.rooms.get(roomName)!.add(connectionId);

		// 記錄連線所在的房間
		if (!this.connectionRooms.has(connectionId)) {
			this.connectionRooms.set(connectionId, new Set());
		}
		this.connectionRooms.get(connectionId)!.add(roomName);
	}

	/**
	 * 離開房間
	 */
	leave(connectionId: string, roomName: string): void {
		// 從房間中移除連線
		const room = this.rooms.get(roomName);
		if (room) {
			room.delete(connectionId);
			// 如果房間空了，清理房間
			if (room.size === 0) {
				this.rooms.delete(roomName);
			}
		}

		// 從連線的房間記錄中移除
		const rooms = this.connectionRooms.get(connectionId);
		if (rooms) {
			rooms.delete(roomName);
			// 如果連線沒有在任何房間，清理記錄
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
