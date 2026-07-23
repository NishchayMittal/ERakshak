try:
    import redis.asyncio.connection
    original_del = redis.asyncio.connection.AbstractConnection.__del__
    def safe_del(self):
        try:
            original_del(self)
        except Exception:
            pass
    redis.asyncio.connection.AbstractConnection.__del__ = safe_del
except Exception:
    pass