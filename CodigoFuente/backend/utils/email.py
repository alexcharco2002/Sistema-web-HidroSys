# utils/email.py
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List
import os
from dotenv import load_dotenv

load_dotenv()

class EmailService:
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", 465))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.from_email = os.getenv("SMTP_FROM", self.smtp_user)
        self.from_name = os.getenv("SMTP_FROM_NAME", "JAAP Sanjapamba")

    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Envía un email HTML"""
        try:
            # Crear mensaje
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.from_name} <{self.from_email}>"
            message["To"] = to_email

            # Crear versión HTML
            html_part = MIMEText(html_content, "html")
            message.attach(html_part)

            # Conectar y enviar
            with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port) as server:
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(message)

            print(f"✅ Email enviado exitosamente a {to_email}")
            return True

        except Exception as e:
            print(f"❌ Error enviando email: {e}")
            return False

    def send_verification_code(self, to_email: str, code: str, username: str) -> bool:
        """Envía código de verificación para recuperación de contraseña"""
        subject = "Código de Verificación - JAAP Sanjapamba"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f4f4f4;
                }}
                .content {{
                    background-color: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }}
                .header {{
                    text-align: center;
                    color: #2563eb;
                    margin-bottom: 20px;
                }}
                .code-box {{
                    background-color: #f0f9ff;
                    border: 2px solid #2563eb;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    margin: 30px 0;
                }}
                .code {{
                    font-size: 32px;
                    font-weight: bold;
                    color: #2563eb;
                    letter-spacing: 5px;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 30px;
                    color: #666;
                    font-size: 12px;
                }}
                .warning {{
                    background-color: #fef3c7;
                    border-left: 4px solid #f59e0b;
                    padding: 15px;
                    margin-top: 20px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="content">
                    <div class="header">
                        <h1>🔐 Recuperación de Contraseña</h1>
                    </div>
                    
                    <p>Hola <strong>{username}</strong>,</p>
                    
                    <p>Hemos recibido una solicitud para recuperar tu contraseña. 
                    Utiliza el siguiente código de verificación:</p>
                    
                    <div class="code-box">
                        <div class="code">{code}</div>
                    </div>
                    
                    <p><strong>Este código expirará en 15 minutos.</strong></p>
                    
                    <div class="warning">
                        <strong>⚠️ Importante:</strong>
                        <ul>
                            <li>No compartas este código con nadie</li>
                            <li>Si no solicitaste este cambio, ignora este mensaje</li>
                            <li>Tu contraseña actual permanece segura</li>
                        </ul>
                    </div>
                    
                    <div class="footer">
                        <p>Este es un mensaje automático, por favor no responder.</p>
                        <p>JAAP Sanjapamba - Sistema de Facturación de Agua</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(to_email, subject, html_content)

# Instancia global
email_service = EmailService()