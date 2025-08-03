import json
import time
import requests
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS

# Инициализация Flask приложения
app = Flask(__name__)
CORS(app)  # Разрешаем CORS для всех маршрутов

# Задаем свои ключи API
API_KEY = '9----'
SECRET_KEY = 'E---'
API_URL = 'https://api-key.fusionbrain.ai/'

# Аутентификация для работы с API
AUTH_HEADERS = {
    'X-Key': f'Key {API_KEY}',
    'X-Secret': f'Secret {SECRET_KEY}',
}

# класс для взаимодействия с API FusionBrain
# содержит методы для работы с пайплайнами и генерации изображений
class FusionBrainAPI:
    def __init__(self):
        self.URL = API_URL


    # Получение списка доступных пайплайнов и возвращение ID первого доступного
    def get_pipeline(self):
        response = requests.get(self.URL + 'key/api/v1/pipelines', headers=AUTH_HEADERS)
        response.raise_for_status() # Проверка успешности запроса
        data = response.json() # Преобразуем ответ в JSON
        return data[0]['id']   # Возвращаем ID первого пайплайна

    def generate(self, prompt, pipeline_id, images=1, width=512, height=512, style="REALISTIC",
                 negative_prompt="низкое качество, размытость, шумы"):

                # Генерация изображения с использованием модели (с помощью запросов к API)
                # :param prompt: Текстовый запрос для генерации изображения
                # :param pipeline_id: ID выбранного пайплайна
                # :param images: Количество изображений для генерации
                # :param width: Ширина изображения
                # :param height: Высота изображения
                # :param style: Стиль изображения
                # :param negative_prompt: Отрицательные признаки для улучшения качества изображения
                # :return: UUID задачи для отслеживания статуса генерации

        params = {
            "type": "GENERATE",
            "numImages": images,
            "width": width,
            "height": height,
            "style": style,
            "negativePromptDecoder": negative_prompt,
            "generateParams": {
                "query": prompt
            }
        }

        #Формируем запрос с параметрами
        files = {
            'pipeline_id': (None, pipeline_id), # ID пайплайна
            'params': (None, json.dumps(params), 'application/json') # Параметры запроса
        }

        # Отправляем запрос на генерацию
        response = requests.post(self.URL + 'key/api/v1/pipeline/run', headers=AUTH_HEADERS, files=files)
        response.raise_for_status()  # Проверка успешности запроса
        return response.json()['uuid']   # Возвращаем UUID задачи для отслеживания

    # Проверка статуса генерации изображени
    def check_generation(self, request_id, attempts=10, delay=5):
        while attempts > 0:
            response = requests.get(self.URL + f'key/api/v1/pipeline/status/{request_id}', headers=AUTH_HEADERS)
            response.raise_for_status() # Проверка успешности запроса
            data = response.json() # Преобразуем ответ в JSON
            status = data.get("status") # Получаем статус генерации

            if status == "DONE": # Если генерация завершена
                return data["result"]["files"]
            elif status == "FAIL": # Если генерация не удалась
                raise Exception("Generation failed.")
            attempts -= 1  # Уменьшаем количество оставшихся попыток
            time.sleep(delay) # Задержка перед следующей проверкой
        raise TimeoutError("Image generation timeout") # Тайм-аут по завершении всех попыток


api = FusionBrainAPI() # Инициализация API

@app.route('/generate-image', methods=['POST'])
def generate_image():
    # Эндпоинт для генерации изображения через Kandinsky
    data = request.get_json()  # Получаем данные из запроса
    prompt = data.get('prompt', '')  # Получаем текстовый запрос (prompt)

    if not prompt: # Проверка на наличие запроса
        return jsonify({'error': 'Missing prompt'}), 400 # Если запрос пустой, возвращаем ошибку

    try: # Получаем ID пайплайна и генерируем изображение
        pipeline_id = api.get_pipeline()
        uuid = api.generate(prompt, pipeline_id)
        image_files = api.check_generation(uuid)

        if image_files:
            # Возвращаем изображение в формате base64
            image_base64 = image_files[0]
            return jsonify({
                'success': True,
                'image': f"data:image/png;base64,{image_base64}"
            })
        else:
            return jsonify({'error': 'Image generation failed'}), 500 # Если изображение не получилось

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500 # Если произошла ошибка, возвращаем 500


@app.route('/health', methods=['GET'])
def health_check():
    # Эндпоинт для проверки состояния сервера
    return jsonify({"status": "healthy", "model": "kandinsky2.1"})


# Запуск приложения Flask
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
