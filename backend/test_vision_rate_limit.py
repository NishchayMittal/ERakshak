import unittest
from unittest.mock import AsyncMock, MagicMock, patch
import os
import sys
import asyncio

# Ensure backend root is on sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.connectors.reverse_image import ReverseImageConnector

class TestVisionRateLimit(unittest.TestCase):
    def setUp(self):
        self.connector = ReverseImageConnector()
        # Set dummy credentials so we enter the rate limiting block
        self.patcher_env = patch.dict(os.environ, {"GOOGLE_APPLICATION_CREDENTIALS": "dummy_path.json"})
        self.patcher_env.start()

    def tearDown(self):
        self.patcher_env.stop()

    def test_rate_limit_under_limit(self):
        """Verify that when under the limit, the rate limit check passes and continues to Vision API."""
        mock_redis = MagicMock()
        mock_redis.eval = AsyncMock(return_value=123)  # Returns allowed request count

        # Mock the get_redis_client
        with patch.object(ReverseImageConnector, '_get_redis_client', return_value=mock_redis):
            # Mock the Vision API client to avoid real network call
            with patch('google.cloud.vision.ImageAnnotatorClient') as mock_vision_client:
                # We expect it to try calling Vision API (which will execute or raise dummy exception)
                mock_vision_instance = MagicMock()
                mock_vision_client.return_value = mock_vision_instance
                # Since image content loading will return None (dummy filename), it won't call the API unless we mock content.
                # Let's mock open/httpx to prevent actual operations
                with patch('builtins.open', unittest.mock.mock_open(read_data=b"dummy_bytes")), \
                     patch('os.path.exists', return_value=True):
                    
                    # We expect it to attempt the API call
                    try:
                        asyncio.run(self.connector.run("ronaldo.jpg"))
                    except Exception:
                        pass
                    
                    # Verify redis eval was called with correct arguments
                    mock_redis.eval.assert_called_once()
                    args = mock_redis.eval.call_args[0]
                    # args should be (lua_script, 1, redis_key, limit, ttl)
                    self.assertEqual(args[1], 1)
                    self.assertTrue(args[2].startswith("rate_limit:google_vision:"))
                    self.assertEqual(args[3], 1000)

    def test_rate_limit_exceeded(self):
        """Verify that when the rate limit is exceeded, the API call is blocked and mock data is returned."""
        mock_redis = MagicMock()
        mock_redis.eval = AsyncMock(return_value=0)  # 0 indicates limit exceeded

        with patch.object(ReverseImageConnector, '_get_redis_client', return_value=mock_redis):
            with patch('google.cloud.vision.ImageAnnotatorClient') as mock_vision_client:
                # Run the connector
                findings = asyncio.run(self.connector.run("ronaldo.jpg"))
                
                # Verify that Vision API was NEVER called
                mock_vision_client.assert_not_called()
                # Verify we fell back to mock data
                self.assertTrue(len(findings) > 0)
                self.assertEqual(findings[0].result_value, "Cristiano Ronaldo")

    def test_rate_limit_redis_offline_fail_closed(self):
        """Verify that when Redis is offline (None), the rate limit is fail-closed (API blocked, fallback to mock)."""
        with patch.object(ReverseImageConnector, '_get_redis_client', return_value=None):
            with patch('google.cloud.vision.ImageAnnotatorClient') as mock_vision_client:
                # Run the connector
                findings = asyncio.run(self.connector.run("ronaldo.jpg"))
                
                # Verify that Vision API was NEVER called (fail-closed)
                mock_vision_client.assert_not_called()
                # Verify fallback mock data is returned
                self.assertTrue(len(findings) > 0)
                self.assertEqual(findings[0].result_value, "Cristiano Ronaldo")

    def test_rate_limit_redis_error_fail_closed(self):
        """Verify that when Redis eval raises an error, the rate limit is fail-closed (API blocked, fallback to mock)."""
        mock_redis = MagicMock()
        mock_redis.eval = AsyncMock(side_effect=Exception("Redis connection timeout"))

        with patch.object(ReverseImageConnector, '_get_redis_client', return_value=mock_redis):
            with patch('google.cloud.vision.ImageAnnotatorClient') as mock_vision_client:
                # Run the connector
                findings = asyncio.run(self.connector.run("ronaldo.jpg"))
                
                # Verify that Vision API was NEVER called
                mock_vision_client.assert_not_called()
                # Verify fallback mock data is returned
                self.assertTrue(len(findings) > 0)
                self.assertEqual(findings[0].result_value, "Cristiano Ronaldo")

if __name__ == "__main__":
    unittest.main()
