import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import os
from dotenv import load_dotenv
import logging
from datetime import datetime
from typing import List, Optional

# Configurar logging
logger = logging.getLogger(__name__)

# Cargar variables de entorno
load_dotenv()

class EmailService:
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", 465))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        # ✅ Usar smtp_user como fallback si SMTP_FROM no está definido
        self.smtp_from = os.getenv("SMTP_FROM", self.smtp_user)
        self.smtp_from_name = os.getenv("SMTP_FROM_NAME", "JAAP Sanjapamba")
        
        # Validar configuración
        if not all([self.smtp_user, self.smtp_password]):
            logger.error("❌ Configuración SMTP incompleta en variables de entorno")
            raise ValueError("Configuración SMTP incompleta")
    
    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """
        Envía un email HTML (método genérico reutilizable)
        
        Args:
            to_email: Email del destinatario
            subject: Asunto del email
            html_content: Contenido HTML del email
            
        Returns:
            True si el envío fue exitoso, False en caso contrario
        """
        try:
            # Crear mensaje
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.smtp_from_name} <{self.smtp_from}>"
            message["To"] = to_email

            # Crear versión HTML
            html_part = MIMEText(html_content, "html", "utf-8")
            message.attach(html_part)

            # ✅ Conectar y enviar usando context manager (como en email.py)
            with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port) as server:
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(message)

            logger.info(f"✅ Email enviado exitosamente a {to_email}")
            return True

        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"❌ Error de autenticación SMTP: {e}")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"❌ Error SMTP: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Error enviando email: {e}")
            return False

    def send_bulk_email(self, to_emails: List[str], subject: str, html_content: str) -> tuple[int, int]:
        """
        Envia el mismo email a varios destinatarios reutilizando una sola conexion SMTP.
        Retorna (exitosos, fallidos).
        """
        if not to_emails:
            return 0, 0

        exitosos = 0
        fallidos = 0

        try:
            with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port) as server:
                server.login(self.smtp_user, self.smtp_password)

                for to_email in to_emails:
                    try:
                        message = MIMEMultipart("alternative")
                        message["Subject"] = subject
                        message["From"] = f"{self.smtp_from_name} <{self.smtp_from}>"
                        message["To"] = to_email
                        message.attach(MIMEText(html_content, "html", "utf-8"))

                        server.send_message(message)
                        exitosos += 1
                    except Exception as e:
                        fallidos += 1
                        logger.error(f"Error enviando email a {to_email}: {e}")

        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"Error de autenticacion SMTP: {e}")
            return 0, len(to_emails)
        except Exception as e:
            logger.error(f"Error abriendo conexion SMTP para envio masivo: {e}")
            return 0, len(to_emails)

        logger.info(f"Email masivo enviado a {exitosos}/{len(to_emails)} destinatarios")
        return exitosos, fallidos

    def build_mantenimiento_html(
        self,
        titulo: str,
        mensaje: str,
        fecha_inicio: datetime,
        fecha_fin: Optional[datetime] = None,
        duracion: Optional[str] = None,
        modulos_afectados: Optional[str] = None
    ) -> str:
        fecha_inicio_str = fecha_inicio.strftime("%d/%m/%Y %H:%M")
        fecha_fin_str = fecha_fin.strftime("%d/%m/%Y %H:%M") if fecha_fin else "Por confirmar"

        return f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
                              color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .info-box {{ background: white; padding: 20px; margin: 15px 0;
                               border-left: 4px solid #f59e0b; border-radius: 8px; }}
                    .info-item {{ margin: 10px 0; }}
                    .label {{ font-weight: bold; color: #6b7280; }}
                    .value {{ color: #1f2937; }}
                    .warning {{ background: #fef3c7; padding: 15px; border-radius: 8px;
                              border-left: 4px solid #f59e0b; margin: 20px 0; }}
                    .footer {{ text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Mantenimiento Programado</h1>
                        <p>{titulo}</p>
                    </div>
                    <div class="content">
                        <p><strong>Estimado usuario,</strong></p>
                        <p>{mensaje}</p>
                        <div class="info-box">
                            <h3>Detalles del Mantenimiento</h3>
                            <div class="info-item"><span class="label">Fecha de inicio:</span> <span class="value">{fecha_inicio_str}</span></div>
                            <div class="info-item"><span class="label">Fecha de finalizacion:</span> <span class="value">{fecha_fin_str}</span></div>
                            {f'<div class="info-item"><span class="label">Duracion estimada:</span> <span class="value">{duracion}</span></div>' if duracion else ''}
                            {f'<div class="info-item"><span class="label">Modulos afectados:</span> <span class="value">{modulos_afectados}</span></div>' if modulos_afectados else ''}
                        </div>
                        <div class="warning">
                            <strong>Recomendaciones:</strong>
                            <ul>
                                <li>Guarde su trabajo antes del inicio del mantenimiento</li>
                                <li>Evite operaciones criticas durante el periodo de mantenimiento</li>
                                <li>Cierre su sesion antes del inicio</li>
                                <li>Sus datos permaneceran seguros</li>
                            </ul>
                        </div>
                        <p>Agradecemos su comprension y colaboracion.</p>
                        <div class="footer">
                            <p>Este es un mensaje automatico, por favor no responda.</p>
                            <p>&copy; {datetime.now().year} {self.smtp_from_name}. Todos los derechos reservados.</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        """

    def enviar_notificacion_mantenimiento(
        self,
        destinatarios: List[str],
        titulo: str,
        mensaje: str,
        fecha_inicio: datetime,
        fecha_fin: Optional[datetime] = None,
        duracion: Optional[str] = None,
        modulos_afectados: Optional[str] = None
    ) -> bool:
        """
        Envía notificación de mantenimiento por correo electrónico
        
        Args:
            destinatarios: Lista de emails
            titulo: Título del mantenimiento
            mensaje: Descripción del mantenimiento
            fecha_inicio: Fecha de inicio
            fecha_fin: Fecha de finalización (opcional)
            duracion: Duración estimada
            modulos_afectados: Módulos afectados
            
        Returns:
            True si el envío fue exitoso, False en caso contrario
        """
        try:
            # Formatear fechas
            fecha_inicio_str = fecha_inicio.strftime("%d/%m/%Y %H:%M")
            fecha_fin_str = fecha_fin.strftime("%d/%m/%Y %H:%M") if fecha_fin else "Por confirmar"
            
            # Crear contenido HTML
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); 
                              color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .info-box {{ background: white; padding: 20px; margin: 15px 0; 
                               border-left: 4px solid #f59e0b; border-radius: 8px; }}
                    .info-item {{ margin: 10px 0; }}
                    .label {{ font-weight: bold; color: #6b7280; }}
                    .value {{ color: #1f2937; }}
                    .warning {{ background: #fef3c7; padding: 15px; border-radius: 8px; 
                              border-left: 4px solid #f59e0b; margin: 20px 0; }}
                    .footer {{ text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>⚠️ Mantenimiento Programado</h1>
                        <p>{titulo}</p>
                    </div>
                    
                    <div class="content">
                        <p><strong>Estimado usuario,</strong></p>
                        <p>{mensaje}</p>
                        
                        <div class="info-box">
                            <h3>📅 Detalles del Mantenimiento</h3>
                            
                            <div class="info-item">
                                <span class="label">🕐 Fecha de inicio:</span>
                                <span class="value">{fecha_inicio_str}</span>
                            </div>
                            
                            <div class="info-item">
                                <span class="label">🕐 Fecha de finalización:</span>
                                <span class="value">{fecha_fin_str}</span>
                            </div>
                            
                            {f'<div class="info-item"><span class="label">⏱️ Duración estimada:</span><span class="value">{duracion}</span></div>' if duracion else ''}
                            
                            {f'<div class="info-item"><span class="label">📦 Módulos afectados:</span><span class="value">{modulos_afectados}</span></div>' if modulos_afectados else ''}
                        </div>
                        
                        <div class="warning">
                            <strong>💡 Recomendaciones:</strong>
                            <ul>
                                <li>Guarde su trabajo antes del inicio del mantenimiento</li>
                                <li>Evite operaciones críticas durante el período de mantenimiento</li>
                                <li>Cierre su sesión antes del inicio</li>
                                <li>Sus datos permanecerán seguros</li>
                            </ul>
                        </div>
                        
                        <p>Agradecemos su comprensión y colaboración.</p>
                        
                        <div class="footer">
                            <p>Este es un mensaje automático, por favor no responda.</p>
                            <p>&copy; {datetime.now().year} {self.smtp_from_name}. Todos los derechos reservados.</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # ✅ Enviar a cada destinatario usando el método genérico
            exitosos = 0
            for destinatario in destinatarios:
                if self.send_email(destinatario, f"⚠️ {titulo}", html_content):
                    exitosos += 1
            
            if exitosos > 0:
                logger.info(f"✅ Email de mantenimiento enviado a {exitosos}/{len(destinatarios)} destinatarios")
                return True
            else:
                logger.error("❌ No se pudo enviar a ningún destinatario")
                return False
            
        except Exception as e:
            logger.error(f"❌ Error preparando email de mantenimiento: {e}")
            return False

# Instancia global
email_service = EmailService()
