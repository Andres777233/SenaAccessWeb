<?php

namespace App\Mail;

use GuzzleHttp\Client;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\MessageConverter;

class BrevoTransport extends AbstractTransport
{
    public function __construct(
        private readonly string $apiKey,
        private readonly string $fromEmail,
        private readonly string $fromName,
    ) {
        parent::__construct();
    }

    protected function doSend(SentMessage $message): void
    {
        $email = MessageConverter::toEmail($message->getOriginalMessage());

        $to = [];
        foreach ($email->getTo() as $address) {
            $to[] = [
                'email' => $address->getAddress(),
                'name' => $address->getName() ?: '',
            ];
        }

        $payload = [
            'sender' => [
                'name' => $this->fromName,
                'email' => $this->fromEmail,
            ],
            'to' => $to,
            'subject' => $email->getSubject(),
            'htmlContent' => (string) ($email->getHtmlBody() ?: $email->getTextBody() ?: ''),
            'textContent' => (string) ($email->getTextBody() ?: ''),
        ];

        $client = new Client(['timeout' => 15]);
        $client->post('https://api.brevo.com/v3/smtp/email', [
            'headers' => [
                'api-key' => $this->apiKey,
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ],
            'json' => $payload,
        ]);
    }
}